#!/usr/bin/env python3
"""
GPU Environment Generator for 勇者傳說 (Hero's Legend)
Designed for Google Colab T4 GPU (16GB VRAM).
Generates seamless tiles, battle backgrounds, and interior scenes.
Output saves to Google Drive; interrupted runs resume automatically.

=== Colab Usage ===

    !pip install -q diffusers transformers accelerate safetensors Pillow scipy
    !python /content/repo/scripts/colab/generate_environments_gpu.py --category tiles
    !python /content/repo/scripts/colab/generate_environments_gpu.py --category battle_backgrounds
    !python /content/repo/scripts/colab/generate_environments_gpu.py --category interiors --model flux

    # 中斷後重跑 → 自動跳過已完成的; 加 --force 全部重做

=== VRAM 預估 (T4 16GB) ===
    Tiles (SDXL txt2img+img2img): ~8 GB  (~10-15s/tile, 4 pipeline calls per tile)
    Battle BGs (SDXL):            ~7 GB  (~8s/image @ 1024x768)
    Battle BGs (Flux.1):          ~12 GB (~20s/image @ 1024x768)
    Interiors (Flux.1):           ~12 GB (~20s/image @ 1024x768)
"""

import argparse
import gc
import json
import sys
import time
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).parent))
from colab_utils import (
    setup_colab, get_output_base, get_prompts_path, get_model_cache_path,
    ProgressTracker, free_vram, print_vram_usage,
)


# ---------------------------------------------------------------------------
# Device
# ---------------------------------------------------------------------------
def detect_device(preferred: str = "auto") -> str:
    import torch
    if preferred == "cpu":
        return "cpu"
    if preferred in ("gpu", "cuda"):
        return "cuda" if torch.cuda.is_available() else "cpu"
    return "cuda" if torch.cuda.is_available() else "cpu"


CATEGORY_DIRS = {
    "tiles": "tiles",
    "battle_backgrounds": "battle_backgrounds",
    "interiors": "interiors",
}


# ---------------------------------------------------------------------------
# Offset-trick seamless tile
# ---------------------------------------------------------------------------
def offset_image(image: Image.Image, dx: int, dy: int) -> Image.Image:
    arr = np.array(image)
    arr = np.roll(arr, dy, axis=0)
    arr = np.roll(arr, dx, axis=1)
    return Image.fromarray(arr)


def generate_seamless_tile(pipe_txt, pipe_i2i, prompt, negative="",
                           gen_size=512, target=64, steps=30,
                           guidance=7.5, strength=0.5):
    """Offset-trick: gen base → offset half → inpaint seams → offset back → downscale."""
    full_prompt = f"seamless tileable texture, {prompt}, pixel art, top-down view, game tile"
    full_neg = negative or "text, watermark, frame, border, non-tileable"
    half = gen_size // 2

    base = pipe_txt(
        prompt=full_prompt, negative_prompt=full_neg,
        width=gen_size, height=gen_size,
        num_inference_steps=steps, guidance_scale=guidance,
    ).images[0]

    offset = offset_image(base, half, half)

    inpainted = pipe_i2i(
        prompt=full_prompt, negative_prompt=full_neg,
        image=offset, strength=strength,
        num_inference_steps=max(10, int(steps * strength)),
        guidance_scale=guidance,
    ).images[0]

    seamless = offset_image(inpainted, half, half)
    tile = seamless.resize((target, target), Image.NEAREST)
    return tile


def render_tiled_preview(tile: Image.Image, grid: int = 4) -> Image.Image:
    w, h = tile.size
    preview = Image.new("RGB", (w * grid, h * grid))
    for r in range(grid):
        for c in range(grid):
            preview.paste(tile, (c * w, r * h))
    return preview


# ---------------------------------------------------------------------------
# Pipeline loaders
# ---------------------------------------------------------------------------
_sdxl_txt = None
_sdxl_i2i = None
_flux_pipe = None


def load_sdxl_pipelines(device: str):
    global _sdxl_txt, _sdxl_i2i
    if _sdxl_txt is not None:
        return _sdxl_txt, _sdxl_i2i

    import torch
    from diffusers import (
        StableDiffusionXLPipeline,
        StableDiffusionXLImg2ImgPipeline,
        DPMSolverMultistepScheduler,
    )

    dtype = torch.float16 if device == "cuda" else torch.bfloat16
    model_path = get_model_cache_path(
        "stable-diffusion-xl-base-1.0",
        "stabilityai/stable-diffusion-xl-base-1.0",
    )

    print(f"[pipeline] Loading SDXL txt2img + img2img ({device})...")
    t0 = time.time()

    kwargs = {"torch_dtype": dtype, "use_safetensors": True}
    if "stabilityai" in model_path:
        kwargs["variant"] = "fp16"

    _sdxl_txt = StableDiffusionXLPipeline.from_pretrained(model_path, **kwargs)
    _sdxl_txt.scheduler = DPMSolverMultistepScheduler.from_config(
        _sdxl_txt.scheduler.config,
        algorithm_type="dpmsolver++", use_karras_sigmas=True,
    )

    try:
        _sdxl_txt.load_lora_weights("nerijs/pixel-art-xl", adapter_name="pixel_xl")
        _sdxl_txt.set_adapters(["pixel_xl"], adapter_weights=[0.8])
        print("[pipeline] pixel-art-xl LoRA loaded")
    except Exception as e:
        print(f"[warn] LoRA failed: {e}")

    _sdxl_txt = _sdxl_txt.to(device)
    _sdxl_txt.enable_attention_slicing()

    _sdxl_i2i = StableDiffusionXLImg2ImgPipeline(
        vae=_sdxl_txt.vae,
        text_encoder=_sdxl_txt.text_encoder,
        text_encoder_2=_sdxl_txt.text_encoder_2,
        tokenizer=_sdxl_txt.tokenizer,
        tokenizer_2=_sdxl_txt.tokenizer_2,
        unet=_sdxl_txt.unet,
        scheduler=_sdxl_txt.scheduler,
    )

    print(f"[pipeline] SDXL ready in {time.time() - t0:.1f}s")
    print_vram_usage()
    return _sdxl_txt, _sdxl_i2i


def load_flux_pipeline(device: str):
    global _flux_pipe
    if _flux_pipe is not None:
        return _flux_pipe

    import torch
    from diffusers import FluxPipeline

    dtype = torch.float16 if device == "cuda" else torch.bfloat16
    model_path = get_model_cache_path("FLUX.1-dev", "black-forest-labs/FLUX.1-dev")

    print(f"[pipeline] Loading Flux.1-dev ({device})...")
    print("[warn] ~12GB VRAM on T4 — if OOM, switch to --model sdxl")
    t0 = time.time()

    _flux_pipe = FluxPipeline.from_pretrained(model_path, torch_dtype=dtype)
    if device == "cuda":
        _flux_pipe.enable_model_cpu_offload()
        _flux_pipe.enable_attention_slicing()
    else:
        _flux_pipe = _flux_pipe.to("cpu")

    print(f"[pipeline] Flux.1-dev ready in {time.time() - t0:.1f}s")
    print_vram_usage()
    return _flux_pipe


# ---------------------------------------------------------------------------
# Tile generation
# ---------------------------------------------------------------------------
def generate_tiles(data, device, output_base, force=False):
    entries = data.get("tiles", [])
    if not entries:
        return

    pipe_txt, pipe_i2i = load_sdxl_pipelines(device)
    out_dir = output_base / "tiles"
    out_dir.mkdir(parents=True, exist_ok=True)
    neg = data["_meta"].get("negative_prompt_xl", "")

    tracker = ProgressTracker("env_tiles", output_base)
    if force:
        tracker.completed.clear()

    remaining = sum(1 for e in entries if not tracker.is_done(e["name"]))
    print(f"\n{'='*60}")
    print(f"  Tiles: {len(entries)} total, {remaining} to generate")
    print(f"{'='*60}")

    for i, entry in enumerate(entries):
        name = entry["name"]
        out_path = out_dir / f"{name}.png"

        if tracker.is_done(name) and out_path.exists():
            print(f"  [{i+1}/{len(entries)}] [skip] {name}")
            continue

        prompt = entry.get("prompt_xl", entry.get("prompt", ""))
        print(f"\n  [{i+1}/{len(entries)}] {name} — {tracker.summary(len(entries))}")
        t0 = time.time()

        tile = generate_seamless_tile(pipe_txt, pipe_i2i, prompt, neg, target=64)
        tile.save(str(out_path), "PNG")

        # 4x4 preview for visual verification
        preview = render_tiled_preview(tile)
        preview_path = out_dir / f"{name}_preview.png"
        preview.save(str(preview_path), "PNG")

        print(f"        saved: {name}.png + preview ({time.time()-t0:.1f}s)")
        tracker.mark_done(name)
        free_vram()


# ---------------------------------------------------------------------------
# Scene generation (battle BGs, interiors)
# ---------------------------------------------------------------------------
def generate_scenes(data, category, model, device, output_base, force=False):
    entries = data.get(category, [])
    if not entries:
        print(f"[warn] No entries for {category}")
        return

    subdir = CATEGORY_DIRS[category]
    out_dir = output_base / subdir
    out_dir.mkdir(parents=True, exist_ok=True)

    tracker = ProgressTracker(f"env_{category}", output_base)
    if force:
        tracker.completed.clear()

    remaining = sum(1 for e in entries if not tracker.is_done(e["name"]))
    print(f"\n{'='*60}")
    print(f"  {category}: {len(entries)} total, {remaining} to generate ({model.upper()})")
    print(f"{'='*60}")

    for i, entry in enumerate(entries):
        name = entry["name"]
        out_path = out_dir / f"{name}.png"

        if tracker.is_done(name) and out_path.exists():
            print(f"  [{i+1}/{len(entries)}] [skip] {name}")
            continue

        prompt = entry.get("prompt_xl", entry.get("prompt", ""))
        w = entry.get("width", 1024)
        h = entry.get("height", 768)

        print(f"\n  [{i+1}/{len(entries)}] {name} ({w}x{h}) — {tracker.summary(len(entries))}")
        t0 = time.time()

        if model == "flux":
            pipe = load_flux_pipeline(device)
            img = pipe(
                prompt=prompt, width=w, height=h,
                num_inference_steps=28, guidance_scale=3.5,
            ).images[0]
        else:
            pipe_txt, _ = load_sdxl_pipelines(device)
            try:
                pipe_txt.set_adapters(["pixel_xl"], adapter_weights=[0.3])
            except Exception:
                pass
            neg = data["_meta"].get("negative_prompt_xl", "")
            img = pipe_txt(
                prompt=prompt, negative_prompt=neg,
                width=w, height=h,
                num_inference_steps=30, guidance_scale=7.5,
            ).images[0]

        img.save(str(out_path), "PNG")
        elapsed = time.time() - t0
        file_size = out_path.stat().st_size / 1024
        print(f"        saved: {name}.png ({file_size:.0f} KB, {elapsed:.1f}s)")

        tracker.mark_done(name)
        free_vram()


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------
def generate_manifest(output_base):
    manifest = {}
    all_dirs = {**CATEGORY_DIRS, "monsters": "monsters", "buildings": "buildings",
                "characters": "characters", "portraits": "portraits"}
    for category, subdir in all_dirs.items():
        dir_path = output_base / subdir
        if not dir_path.exists():
            continue
        keys = sorted(f.stem for f in dir_path.glob("*.png")
                       if not f.stem.startswith("_") and not f.stem.endswith("_preview"))
        if keys:
            manifest[category] = keys

    manifest_path = output_base / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n[manifest] {manifest_path}")
    for cat, keys in manifest.items():
        print(f"  {cat}: {len(keys)}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="GPU Environment Generator for 勇者傳說 (Colab T4)"
    )
    parser.add_argument("--model", type=str, default="sdxl",
                        choices=["sdxl", "flux"],
                        help="Model for scenes (tiles always use SDXL)")
    parser.add_argument("--device", type=str, default="auto",
                        choices=["auto", "gpu", "cpu"])
    parser.add_argument("--category", type=str,
                        choices=list(CATEGORY_DIRS.keys()))
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--force", action="store_true",
                        help="Ignore progress, regenerate all")
    parser.add_argument("--manifest-only", action="store_true")

    args = parser.parse_args()
    output_base = setup_colab("Environment Generator")

    if args.manifest_only:
        generate_manifest(output_base)
        return

    if not (args.all or args.category):
        parser.print_help()
        sys.exit(1)

    prompts_path = get_prompts_path("asset_prompts.json")
    with open(prompts_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    device = detect_device(args.device)
    print(f"[device] {device}")

    if args.category:
        if args.category == "tiles":
            generate_tiles(data, device, output_base, args.force)
        else:
            generate_scenes(data, args.category, args.model, device, output_base, args.force)
    elif args.all:
        generate_tiles(data, device, output_base, args.force)
        for cat in ["battle_backgrounds", "interiors"]:
            if data.get(cat):
                generate_scenes(data, cat, args.model, device, output_base, args.force)

    generate_manifest(output_base)
    print("\n[done] Environment generation complete!")


if __name__ == "__main__":
    main()
