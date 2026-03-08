#!/usr/bin/env python3
"""
GPU Sprite Generator for 勇者傳說 (Hero's Legend)
Designed for Google Colab T4 GPU (16GB VRAM).
Output saves to Google Drive for persistence; interrupted runs resume automatically.

Uses SDXL + pixel-art-xl LoRA for sprites, Flux.1-dev for scene backgrounds.

=== Colab Usage (在 notebook cell 中執行) ===

    # 1. 上傳 asset_prompts.json 到 Google Drive:
    #    /MyDrive/ai-rpg-game/prompts/asset_prompts.json

    # 2. 在 Colab cell 中:
    !pip install -q diffusers transformers accelerate safetensors Pillow rembg onnxruntime
    !git clone <repo_url> /content/repo  # 或上傳腳本
    !python /content/repo/scripts/colab/generate_sprites_gpu.py --category monsters
    !python /content/repo/scripts/colab/generate_sprites_gpu.py --category portraits
    !python /content/repo/scripts/colab/generate_sprites_gpu.py --category buildings

    # 中斷後重跑同一指令 → 自動跳過已完成的圖片 (無需 --force)
    # 加 --force 會重新產生所有圖片

=== VRAM 預估 (T4 16GB) ===
    SDXL fp16 + LoRA:       ~7 GB   (~5-8s/image)
    Flux.1-dev fp16+offload: ~12 GB  (~15-20s/image)
    rembg u2net:             ~0.5 GB

=== 本地 Usage ===
    python scripts/colab/generate_sprites_gpu.py --category monsters --device cpu
"""

import argparse
import gc
import json
import sys
import time
from pathlib import Path

# Add parent to path for colab_utils import
sys.path.insert(0, str(Path(__file__).parent))
from colab_utils import (
    setup_colab, get_output_base, get_prompts_path, get_model_cache_path,
    ProgressTracker, free_vram, print_vram_usage,
)


# ---------------------------------------------------------------------------
# Device detection
# ---------------------------------------------------------------------------
def detect_device(preferred: str = "auto") -> str:
    import torch
    if preferred == "cpu":
        return "cpu"
    if preferred in ("gpu", "cuda"):
        return "cuda" if torch.cuda.is_available() else "cpu"
    return "cuda" if torch.cuda.is_available() else "cpu"


def get_torch_dtype(device: str):
    import torch
    return torch.float16 if device == "cuda" else torch.bfloat16


# ---------------------------------------------------------------------------
# Hub IDs
# ---------------------------------------------------------------------------
SDXL_HUB_ID = "stabilityai/stable-diffusion-xl-base-1.0"
PIXEL_ART_XL_HUB_ID = "nerijs/pixel-art-xl"
FLUX_HUB_ID = "black-forest-labs/FLUX.1-dev"

CATEGORY_DIRS = {
    "tiles": "tiles",
    "characters": "characters",
    "monsters": "monsters",
    "buildings": "buildings",
    "decorations": "decorations",
    "battle_backgrounds": "battle_backgrounds",
    "portraits": "portraits",
    "interiors": "interiors",
}


# ---------------------------------------------------------------------------
# Background removal
# ---------------------------------------------------------------------------
_rembg_session = None


def remove_background(image):
    """Remove background from PIL Image. Tries RMBG-2.0 first, then rembg."""
    global _rembg_session

    try:
        from transformers import pipeline as hf_pipeline
        pipe = hf_pipeline("image-segmentation", model="briaai/RMBG-2.0",
                           trust_remote_code=True, device="cpu")
        result = pipe(image, return_mask=True)
        image = image.convert("RGBA")
        image.putalpha(result)
        return image
    except Exception:
        pass

    try:
        from rembg import remove, new_session
        if _rembg_session is None:
            _rembg_session = new_session("u2net")
        return remove(image, session=_rembg_session)
    except Exception:
        pass

    print("[warn] No background removal available")
    return image.convert("RGBA")


# ---------------------------------------------------------------------------
# SDXL Pipeline
# ---------------------------------------------------------------------------
_sdxl_pipe = None


def load_sdxl_pipeline(device: str):
    global _sdxl_pipe
    if _sdxl_pipe is not None:
        return _sdxl_pipe

    import torch
    from diffusers import StableDiffusionXLPipeline, DPMSolverMultistepScheduler

    dtype = get_torch_dtype(device)
    model_path = get_model_cache_path("stable-diffusion-xl-base-1.0", SDXL_HUB_ID)

    print(f"[pipeline] Loading SDXL ({device}, {dtype})...")
    t0 = time.time()

    kwargs = {"torch_dtype": dtype, "use_safetensors": True}
    if model_path == SDXL_HUB_ID:
        kwargs["variant"] = "fp16"

    pipe = StableDiffusionXLPipeline.from_pretrained(model_path, **kwargs)
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(
        pipe.scheduler.config,
        algorithm_type="dpmsolver++",
        use_karras_sigmas=True,
    )

    try:
        pipe.load_lora_weights(PIXEL_ART_XL_HUB_ID, adapter_name="pixel_xl")
        pipe.set_adapters(["pixel_xl"], adapter_weights=[0.8])
        print("[pipeline] pixel-art-xl LoRA loaded (weight=0.8)")
    except Exception as e:
        print(f"[warn] LoRA failed: {e}")

    if device == "cuda":
        pipe = pipe.to("cuda")
        pipe.enable_attention_slicing()
    else:
        pipe = pipe.to("cpu")
        pipe.enable_attention_slicing()
        if hasattr(pipe, "enable_vae_tiling"):
            pipe.enable_vae_tiling()

    print(f"[pipeline] SDXL ready in {time.time() - t0:.1f}s")
    print_vram_usage()
    _sdxl_pipe = pipe
    return pipe


# ---------------------------------------------------------------------------
# Flux.1-dev Pipeline
# ---------------------------------------------------------------------------
_flux_pipe = None


def load_flux_pipeline(device: str):
    global _flux_pipe
    if _flux_pipe is not None:
        return _flux_pipe

    import torch
    from diffusers import FluxPipeline

    dtype = torch.float16 if device == "cuda" else torch.bfloat16
    model_path = get_model_cache_path("FLUX.1-dev", FLUX_HUB_ID)

    print(f"[pipeline] Loading Flux.1-dev ({device})...")
    print("[pipeline] Warning: ~12GB VRAM on T4 — may be tight")
    t0 = time.time()

    pipe = FluxPipeline.from_pretrained(model_path, torch_dtype=dtype)

    if device == "cuda":
        pipe.enable_model_cpu_offload()
        pipe.enable_attention_slicing()
    else:
        pipe = pipe.to("cpu")

    print(f"[pipeline] Flux.1-dev ready in {time.time() - t0:.1f}s")
    print_vram_usage()
    _flux_pipe = pipe
    return pipe


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------
def generate_sprite_sdxl(pipe, prompt, negative_prompt, size=512,
                         steps=30, guidance=7.5, seed=-1):
    import torch
    generator = None
    if seed >= 0:
        generator = torch.Generator(device=pipe.device).manual_seed(seed)
    result = pipe(
        prompt=prompt, negative_prompt=negative_prompt,
        width=size, height=size,
        num_inference_steps=steps, guidance_scale=guidance,
        generator=generator,
    )
    return result.images[0]


def generate_scene_flux(pipe, prompt, width=1024, height=768,
                        steps=28, guidance=3.5, seed=-1):
    import torch
    generator = None
    if seed >= 0:
        generator = torch.Generator(device="cpu").manual_seed(seed)
    result = pipe(
        prompt=prompt, width=width, height=height,
        num_inference_steps=steps, guidance_scale=guidance,
        generator=generator,
    )
    return result.images[0]


# ---------------------------------------------------------------------------
# Prompt builders
# ---------------------------------------------------------------------------
def build_sprite_prompt(entry, meta, category):
    prompt_text = entry.get("prompt_xl", entry.get("prompt", ""))
    suffix_key = f"style_suffix_{category.rstrip('s')}_xl"
    suffix = meta.get(suffix_key, meta.get("style_suffix_pixel_xl", ""))
    prefix = meta.get("style_prefix_xl", "")
    if prefix:
        prompt_text = f"{prefix}, {prompt_text}"
    if suffix:
        prompt_text = f"{prompt_text}, {suffix}"
    neg = entry.get("negative_prompt", meta.get("negative_prompt_xl", ""))
    return prompt_text, neg


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------
def postprocess_sprite(image, entry, category, do_rembg=True):
    from PIL import Image
    target_size = entry.get("size", 192)

    if do_rembg and category not in ("battle_backgrounds", "interiors", "tiles"):
        image = remove_background(image)

    if image.mode == "RGBA":
        bbox = image.getbbox()
        if bbox:
            image = image.crop(bbox)

    if category in ("battle_backgrounds", "interiors"):
        pass
    elif category == "tiles":
        image = image.resize((64, 64), Image.NEAREST)
    elif category == "portraits":
        image = image.resize((target_size, target_size), Image.LANCZOS)
    else:
        w, h = image.size
        scale = min(target_size / w, target_size / h)
        new_w, new_h = int(w * scale), int(h * scale)
        image = image.resize((new_w, new_h), Image.NEAREST)
        canvas = Image.new("RGBA", (target_size, target_size), (0, 0, 0, 0))
        paste_x = (target_size - new_w) // 2
        paste_y = target_size - new_h
        canvas.paste(image, (paste_x, paste_y), image if image.mode == "RGBA" else None)
        image = canvas

    return image


# ---------------------------------------------------------------------------
# Orchestrator
# ---------------------------------------------------------------------------
def generate_entry(pipe, entry, meta, category, model_type, output_base, tracker):
    """Generate a single asset. Returns True if generated, False if skipped."""
    name = entry["name"]
    subdir = CATEGORY_DIRS.get(category, category)
    out_dir = output_base / subdir
    out_path = out_dir / f"{name}.png"

    # Resume check
    if tracker.is_done(name) and out_path.exists():
        print(f"  [skip] {name} (already completed)")
        return False

    out_dir.mkdir(parents=True, exist_ok=True)
    t0 = time.time()

    if model_type == "flux":
        prompt = entry.get("prompt_xl", entry.get("prompt", ""))
        w = entry.get("width", 1024)
        h = entry.get("height", 768)
        steps = entry.get("steps_flux", 28)
        guidance = entry.get("guidance_flux", 3.5)
        print(f"  [gen] {name} (Flux.1, {w}x{h}, {steps} steps)")
        image = generate_scene_flux(pipe, prompt, w, h, steps, guidance)
        do_rembg = False
    else:
        prompt, neg = build_sprite_prompt(entry, meta, category)
        size = 512
        steps = entry.get("steps_xl", 30)
        guidance = entry.get("guidance_xl", 7.5)
        print(f"  [gen] {name} (SDXL, {size}x{size}, {steps} steps)")
        image = generate_sprite_sdxl(pipe, prompt, neg, size, steps, guidance)
        do_rembg = True

    image = postprocess_sprite(image, entry, category, do_rembg=do_rembg)
    image.save(str(out_path), "PNG")

    elapsed = time.time() - t0
    file_size = out_path.stat().st_size / 1024
    print(f"        saved: {out_path.name} ({file_size:.0f} KB, {elapsed:.1f}s)")

    tracker.mark_done(name)
    free_vram()
    return True


def generate_category(pipe, data, category, model_type, output_base, force=False):
    meta = data.get("_meta", {})
    entries = data.get(category, [])
    if not entries:
        print(f"[warn] No entries for '{category}'")
        return

    # Progress tracker for resume
    tracker = ProgressTracker(f"sprites_{category}", output_base)
    if force:
        tracker.completed.clear()

    # Count remaining
    remaining = sum(1 for e in entries if not tracker.is_done(e["name"]))

    print(f"\n{'='*60}")
    print(f"  {category}: {len(entries)} total, {remaining} to generate")
    print(f"  Model: {model_type.upper()}, Output: {output_base}")
    print(f"{'='*60}")

    generated = 0
    for i, entry in enumerate(entries):
        print(f"\n  [{i+1}/{len(entries)}] {tracker.summary(len(entries))}")
        if generate_entry(pipe, entry, meta, category, model_type, output_base, tracker):
            generated += 1

    print(f"\n  Done: generated {generated}, skipped {len(entries) - generated}")


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------
def generate_manifest(output_base: Path):
    manifest = {}
    for category, subdir in CATEGORY_DIRS.items():
        dir_path = output_base / subdir
        if not dir_path.exists():
            continue
        keys = sorted(f.stem for f in dir_path.glob("*.png")
                       if not f.stem.startswith("_"))
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
        description="GPU Sprite Generator for 勇者傳說 (Colab T4)"
    )
    parser.add_argument("--model", type=str, default="sdxl",
                        choices=["sdxl", "flux"],
                        help="Model (default: sdxl)")
    parser.add_argument("--device", type=str, default="auto",
                        choices=["auto", "gpu", "cpu"],
                        help="Device (default: auto-detect)")
    parser.add_argument("--category", type=str,
                        choices=list(CATEGORY_DIRS.keys()),
                        help="Category to generate")
    parser.add_argument("--name", type=str,
                        help="Single asset by name")
    parser.add_argument("--all", action="store_true",
                        help="Generate all categories")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite + ignore progress (re-generate all)")
    parser.add_argument("--test", action="store_true",
                        help="Generate 1 test sprite")
    parser.add_argument("--manifest-only", action="store_true",
                        help="Only regenerate manifest.json")

    args = parser.parse_args()

    # Colab setup: mount Drive, detect GPU, set output path
    output_base = setup_colab("Sprite Generator")

    if args.manifest_only:
        generate_manifest(output_base)
        return

    if not (args.test or args.all or args.category or args.name):
        parser.print_help()
        sys.exit(1)

    # Load prompts (from Drive or local)
    prompts_path = get_prompts_path("asset_prompts.json")
    with open(prompts_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    device = detect_device(args.device)
    print(f"[device] {device}")

    # Load pipeline
    if args.model == "flux":
        pipe = load_flux_pipeline(device)
    else:
        pipe = load_sdxl_pipeline(device)

    if args.test:
        meta = data.get("_meta", {})
        test_entry = data.get("monsters", [{}])[0]
        if test_entry:
            tracker = ProgressTracker("sprites_test", output_base)
            generate_entry(pipe, test_entry, meta, "monsters", args.model, output_base, tracker)

    elif args.name:
        meta = data.get("_meta", {})
        found = False
        for cat in CATEGORY_DIRS:
            for entry in data.get(cat, []):
                if entry.get("name") == args.name:
                    tracker = ProgressTracker(f"sprites_{cat}", output_base)
                    if args.force:
                        tracker.completed.discard(args.name)
                    generate_entry(pipe, entry, meta, cat, args.model, output_base, tracker)
                    found = True
                    break
            if found:
                break
        if not found:
            print(f"[error] '{args.name}' not found")
            sys.exit(1)

    elif args.category:
        generate_category(pipe, data, args.category, args.model, output_base, args.force)

    elif args.all:
        for cat in CATEGORY_DIRS:
            if not data.get(cat):
                continue
            if cat in ("battle_backgrounds", "interiors") and args.model != "sdxl":
                flux_pipe = load_flux_pipeline(device)
                generate_category(flux_pipe, data, cat, "flux", output_base, args.force)
            else:
                generate_category(pipe, data, cat, args.model, output_base, args.force)

    generate_manifest(output_base)
    print("\n[done] Sprite generation complete!")


if __name__ == "__main__":
    main()
