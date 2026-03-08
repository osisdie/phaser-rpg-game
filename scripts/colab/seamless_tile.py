#!/usr/bin/env python3
"""
Seamless Tile Generator for 勇者傳說 (Hero's Legend)
Uses the offset-trick pipeline to create seamless 64x64 tiles.

Algorithm:
  1. Generate 512x512 base tile with SDXL + pixel-art LoRA
  2. Offset image by half in X/Y (wrapping edges to center)
  3. Inpaint center seam via SDXL img2img (strength 0.5)
  4. Offset back — result is seamless
  5. Downscale to 64x64 with NEAREST

Usage:
    python scripts/colab/seamless_tile.py --prompt "lush green grass tile" --name tile_grass
    python scripts/colab/seamless_tile.py --preview  # render 4x4 tiled grid
"""

import argparse
import json
import sys
import time
from pathlib import Path

from PIL import Image
import numpy as np

SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent.parent
OUTPUT_DIR = PROJECT_DIR / "public" / "assets" / "ai" / "tiles"


def offset_image(image: Image.Image, dx: int, dy: int) -> Image.Image:
    """Roll/wrap an image by (dx, dy) pixels."""
    arr = np.array(image)
    arr = np.roll(arr, dy, axis=0)
    arr = np.roll(arr, dx, axis=1)
    return Image.fromarray(arr)


def create_seam_mask(size: int, band_width: int = 64) -> Image.Image:
    """Create a mask highlighting the center cross (where seams are after offset)."""
    mask = Image.new("L", (size, size), 0)
    arr = np.array(mask)
    cx, cy = size // 2, size // 2

    # Horizontal band
    arr[cy - band_width // 2 : cy + band_width // 2, :] = 255
    # Vertical band
    arr[:, cx - band_width // 2 : cx + band_width // 2] = 255

    # Feather edges with gaussian-like gradient
    from scipy.ndimage import gaussian_filter
    arr = gaussian_filter(arr.astype(float), sigma=band_width // 4)
    arr = (arr / arr.max() * 255).astype(np.uint8)

    return Image.fromarray(arr)


def generate_seamless_tile(
    pipe_txt2img,
    pipe_img2img,
    prompt: str,
    negative_prompt: str = "",
    gen_size: int = 512,
    target_size: int = 64,
    steps: int = 30,
    guidance: float = 7.5,
    inpaint_strength: float = 0.5,
    seed: int = -1,
):
    """Generate a seamless tile using the offset trick."""
    import torch

    generator = None
    if seed >= 0:
        generator = torch.Generator(device=pipe_txt2img.device).manual_seed(seed)

    # Step 1: Generate base tile
    print("  [step 1/4] Generating base tile...")
    result = pipe_txt2img(
        prompt=prompt,
        negative_prompt=negative_prompt,
        width=gen_size,
        height=gen_size,
        num_inference_steps=steps,
        guidance_scale=guidance,
        generator=generator,
    )
    base = result.images[0]

    # Step 2: Offset by half (wrap edges to center)
    print("  [step 2/4] Offsetting image...")
    half = gen_size // 2
    offset = offset_image(base, half, half)

    # Step 3: Inpaint center seam
    print("  [step 3/4] Inpainting seams...")
    # Use img2img on the offset image to blend the center seams
    inpainted = pipe_img2img(
        prompt=prompt,
        negative_prompt=negative_prompt,
        image=offset,
        strength=inpaint_strength,
        num_inference_steps=max(10, int(steps * inpaint_strength)),
        guidance_scale=guidance,
    ).images[0]

    # Step 4: Offset back
    print("  [step 4/4] Offsetting back + downscaling...")
    seamless = offset_image(inpainted, half, half)

    # Downscale to target size with NEAREST for pixel art
    tile = seamless.resize((target_size, target_size), Image.NEAREST)

    return tile, seamless  # Return both small and full-res


def render_tiled_preview(tile: Image.Image, grid: int = 4) -> Image.Image:
    """Render a grid x grid tiled preview to verify seamlessness."""
    w, h = tile.size
    preview = Image.new("RGB", (w * grid, h * grid))
    for row in range(grid):
        for col in range(grid):
            preview.paste(tile, (col * w, row * h))
    return preview


def main():
    parser = argparse.ArgumentParser(description="Seamless Tile Generator")
    parser.add_argument("--prompt", type=str, required=True,
                        help="Text prompt for tile generation")
    parser.add_argument("--name", type=str, required=True,
                        help="Output filename (without extension)")
    parser.add_argument("--negative", type=str, default="",
                        help="Negative prompt")
    parser.add_argument("--size", type=int, default=512,
                        help="Generation size (default: 512)")
    parser.add_argument("--target", type=int, default=64,
                        help="Final tile size (default: 64)")
    parser.add_argument("--steps", type=int, default=30,
                        help="Inference steps (default: 30)")
    parser.add_argument("--guidance", type=float, default=7.5,
                        help="Guidance scale (default: 7.5)")
    parser.add_argument("--strength", type=float, default=0.5,
                        help="Inpaint strength for seam fix (default: 0.5)")
    parser.add_argument("--seed", type=int, default=-1,
                        help="Random seed (-1 for random)")
    parser.add_argument("--preview", action="store_true",
                        help="Also save 4x4 tiled preview")
    parser.add_argument("--device", type=str, default="auto",
                        choices=["auto", "gpu", "cpu"],
                        help="Device (default: auto)")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite existing files")

    args = parser.parse_args()

    import torch
    from diffusers import (
        StableDiffusionXLPipeline,
        StableDiffusionXLImg2ImgPipeline,
        DPMSolverMultistepScheduler,
    )

    # Device
    device = "cuda" if (args.device != "cpu" and torch.cuda.is_available()) else "cpu"
    dtype = torch.float16 if device == "cuda" else torch.bfloat16
    print(f"[device] Using: {device}")

    # Output path
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    out_path = OUTPUT_DIR / f"{args.name}.png"
    if not args.force and out_path.exists():
        print(f"[skip] {args.name} already exists")
        sys.exit(0)

    # Load SDXL pipelines
    print("[pipeline] Loading SDXL txt2img + img2img...")
    t0 = time.time()

    sdxl_id = "stabilityai/stable-diffusion-xl-base-1.0"
    pipe_txt = StableDiffusionXLPipeline.from_pretrained(
        sdxl_id, torch_dtype=dtype, use_safetensors=True,
        variant="fp16" if device == "cuda" else None,
    )
    pipe_txt.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe_txt.scheduler.config, algorithm_type="dpmsolver++", use_karras_sigmas=True,
    )

    # Load LoRA
    try:
        pipe_txt.load_lora_weights("nerijs/pixel-art-xl", adapter_name="pixel_xl")
        pipe_txt.set_adapters(["pixel_xl"], adapter_weights=[0.8])
        print("[pipeline] pixel-art-xl LoRA loaded")
    except Exception as e:
        print(f"[warn] LoRA failed: {e}")

    pipe_txt = pipe_txt.to(device)

    # img2img shares components
    pipe_i2i = StableDiffusionXLImg2ImgPipeline(
        vae=pipe_txt.vae,
        text_encoder=pipe_txt.text_encoder,
        text_encoder_2=pipe_txt.text_encoder_2,
        tokenizer=pipe_txt.tokenizer,
        tokenizer_2=pipe_txt.tokenizer_2,
        unet=pipe_txt.unet,
        scheduler=pipe_txt.scheduler,
    )

    print(f"[pipeline] Ready in {time.time() - t0:.1f}s")

    # Add tileable hint to prompt
    tile_prompt = f"seamless tileable texture, {args.prompt}, pixel art, top-down view, game tile"
    neg = args.negative or "text, watermark, frame, border, edge artifacts, non-tileable"

    # Generate
    print(f"\n[gen] {args.name}")
    tile, full = generate_seamless_tile(
        pipe_txt, pipe_i2i,
        prompt=tile_prompt,
        negative_prompt=neg,
        gen_size=args.size,
        target_size=args.target,
        steps=args.steps,
        guidance=args.guidance,
        inpaint_strength=args.strength,
        seed=args.seed,
    )

    tile.save(str(out_path), "PNG")
    print(f"  saved: {out_path} ({out_path.stat().st_size / 1024:.0f} KB)")

    if args.preview:
        preview = render_tiled_preview(tile)
        preview_path = out_path.with_name(f"{args.name}_preview.png")
        preview.save(str(preview_path), "PNG")
        print(f"  preview: {preview_path}")

    print("\n[done] Seamless tile generation complete!")


if __name__ == "__main__":
    main()
