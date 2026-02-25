#!/usr/bin/env python3
"""
AI Asset Generator for 勇者傳說 (Hero's Legend)
Uses SD 1.5 + LCM-LoRA + PixelArt LoRA to generate game sprites on CPU.

Usage:
    # Test with 2 sample images
    python scripts/generate_assets.py --test

    # Generate specific category
    python scripts/generate_assets.py --category tiles

    # Generate everything
    python scripts/generate_assets.py --all

    # Generate a single asset by name
    python scripts/generate_assets.py --name mon_slime

    # Use SD Turbo for faster (lower quality) generation
    python scripts/generate_assets.py --turbo --test
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

# Fix: transformers 5.x removed MT5Tokenizer; HunyuanDiT in diffusers requires it.
# Inject T5Tokenizer as MT5Tokenizer before any diffusers import.
def _patch_mt5_tokenizer():
    import transformers
    if not hasattr(transformers, "MT5Tokenizer"):
        from transformers import T5Tokenizer
        transformers.MT5Tokenizer = T5Tokenizer


_patch_mt5_tokenizer()

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
PROMPTS_FILE = SCRIPT_DIR / "asset_prompts.json"
OUTPUT_DIR = PROJECT_DIR / "public" / "assets" / "ai"
MODELS_DIR = Path("/mnt/c/writable/models")

# Model paths
SD15_MODEL = MODELS_DIR / "stable-diffusion-v1-5"
LCM_LORA = MODELS_DIR / "lcm-lora-sdv1-5"
PIXEL_LORA_DIR = MODELS_DIR / "loras" / "pixelart-redmond-15v"
SD_TURBO_MODEL = MODELS_DIR / "sd-turbo"

# ---------------------------------------------------------------------------
# Prompt templates
# ---------------------------------------------------------------------------
def load_prompts() -> dict:
    with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def build_prompt(asset: dict, meta: dict) -> str:
    """Compose the full positive prompt from style prefix + subject + technical suffix."""
    parts = [meta["style_prefix"]]
    parts.append(asset["prompt"])

    # Choose suffix based on category context (caller sets this)
    suffix_key = asset.get("_suffix_key", "style_suffix_pixel")
    parts.append(meta[suffix_key])

    return ", ".join(parts)


def get_negative_prompt(meta: dict) -> str:
    return meta["negative_prompt"]


# ---------------------------------------------------------------------------
# Pipeline loader
# ---------------------------------------------------------------------------
_pipe = None


def load_pipeline(turbo: bool = False):
    """Load the Stable Diffusion pipeline (cached across calls)."""
    global _pipe
    if _pipe is not None:
        return _pipe

    import torch
    from diffusers import (
        StableDiffusionPipeline,
        LCMScheduler,
        DPMSolverMultistepScheduler,
    )

    print("[pipeline] Loading model...")
    t0 = time.time()

    if turbo:
        # SD Turbo: 1-step generation, fastest option
        from diffusers import AutoPipelineForText2Image

        if not SD_TURBO_MODEL.exists():
            print(f"[error] SD Turbo model not found at {SD_TURBO_MODEL}")
            print("  Run: huggingface-cli download stabilityai/sd-turbo \\")
            print(f"       --local-dir {SD_TURBO_MODEL}")
            sys.exit(1)

        _pipe = AutoPipelineForText2Image.from_pretrained(
            str(SD_TURBO_MODEL),
            torch_dtype=torch.float32,
            local_files_only=True,
        )
        # SD Turbo uses 1 step, guidance_scale=0
        _pipe._turbo = True
        print(f"[pipeline] SD Turbo loaded in {time.time() - t0:.1f}s")

    else:
        # SD 1.5 + LCM-LoRA + PixelArt LoRA
        if not SD15_MODEL.exists():
            print(f"[error] SD 1.5 model not found at {SD15_MODEL}")
            print("  Run: huggingface-cli download runwayml/stable-diffusion-v1-5 \\")
            print(f"       --local-dir {SD15_MODEL}")
            sys.exit(1)

        _pipe = StableDiffusionPipeline.from_pretrained(
            str(SD15_MODEL),
            torch_dtype=torch.float32,
            safety_checker=None,
            requires_safety_checker=False,
            local_files_only=True,
        )

        # Load LCM-LoRA for 4-step inference (requires peft: pip install peft)
        if LCM_LORA.exists() and (LCM_LORA / "pytorch_lora_weights.safetensors").exists():
            print("[pipeline] Loading LCM-LoRA for accelerated inference...")
            _pipe.load_lora_weights(
                str(LCM_LORA),
                weight_name="pytorch_lora_weights.safetensors",
                adapter_name="lcm",
            )
            _pipe.scheduler = LCMScheduler.from_config(_pipe.scheduler.config)
            _pipe._use_lcm = True
            print("[pipeline]   LCM-LoRA loaded — 4-step inference enabled")
        else:
            print(f"[warn] LCM-LoRA not found at {LCM_LORA}, using DPMSolver (slower)")
            _pipe.scheduler = DPMSolverMultistepScheduler.from_config(
                _pipe.scheduler.config
            )
            _pipe._use_lcm = False

        # Load PixelArt LoRA for style
        pixel_lora_file = find_lora_file(PIXEL_LORA_DIR)
        if pixel_lora_file:
            print(f"[pipeline] Loading PixelArt LoRA: {pixel_lora_file.name}")
            _pipe.load_lora_weights(
                str(pixel_lora_file.parent),
                weight_name=pixel_lora_file.name,
                adapter_name="pixel",
            )
            # Set adapter weights: LCM=1.0, Pixel=0.8
            if hasattr(_pipe, "_use_lcm") and _pipe._use_lcm:
                _pipe.set_adapters(["lcm", "pixel"], adapter_weights=[1.0, 0.8])
            else:
                _pipe.set_adapters(["pixel"], adapter_weights=[0.8])
            print("[pipeline]   PixelArt LoRA loaded")
        else:
            print(f"[warn] PixelArt LoRA not found in {PIXEL_LORA_DIR}")

        _pipe._turbo = False
        print(f"[pipeline] SD 1.5 pipeline loaded in {time.time() - t0:.1f}s")

    # CPU optimizations
    _pipe = _pipe.to("cpu")
    if hasattr(_pipe, "enable_attention_slicing"):
        _pipe.enable_attention_slicing()  # Reduce peak memory

    return _pipe


def find_lora_file(directory: Path) -> Path | None:
    """Find a .safetensors LoRA file in a directory."""
    if not directory.exists():
        return None
    for f in directory.rglob("*.safetensors"):
        return f
    for f in directory.rglob("*.bin"):
        return f
    return None


# ---------------------------------------------------------------------------
# Image generation
# ---------------------------------------------------------------------------
def generate_image(
    pipe,
    prompt: str,
    negative_prompt: str,
    size: int = 512,
    seed: int | None = None,
) -> "Image":
    """Generate a single image and return a PIL Image."""
    import torch
    from PIL import Image

    generator = torch.Generator("cpu")
    if seed is not None:
        generator.manual_seed(seed)
    else:
        generator.manual_seed(int(time.time()) % (2**32))

    # Inference parameters depend on pipeline type
    if getattr(pipe, "_turbo", False):
        result = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=1,
            guidance_scale=0.0,
            width=size,
            height=size,
            generator=generator,
        )
    elif getattr(pipe, "_use_lcm", False):
        result = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=4,
            guidance_scale=1.5,
            width=size,
            height=size,
            generator=generator,
        )
    else:
        result = pipe(
            prompt=prompt,
            negative_prompt=negative_prompt,
            num_inference_steps=20,
            guidance_scale=7.5,
            width=size,
            height=size,
            generator=generator,
        )

    return result.images[0]


def downscale_nearest(img: "Image", target_size: int) -> "Image":
    """Downscale using nearest-neighbor to preserve pixel art crispness."""
    from PIL import Image

    return img.resize((target_size, target_size), Image.NEAREST)


# ---------------------------------------------------------------------------
# Asset generation
# ---------------------------------------------------------------------------
def generate_asset(pipe, asset: dict, meta: dict, output_base: Path, category: str):
    """Generate a single asset image, downscale, and save."""
    name = asset["name"]
    target_size = asset["size"]

    # Determine output subdirectory
    subdir_map = {
        "tiles": "tiles",
        "buildings": "buildings",
        "characters": "characters",
        "monsters": "monsters",
        "decorations": "tiles",  # decorations go alongside tiles
    }
    subdir = subdir_map.get(category, category)
    out_dir = output_base / subdir
    out_dir.mkdir(parents=True, exist_ok=True)

    out_path = out_dir / f"{name}.png"
    if out_path.exists():
        print(f"  [skip] {out_path} already exists")
        return

    # Build prompt
    suffix_map = {
        "tiles": "style_suffix_pixel",
        "buildings": "style_suffix_pixel",
        "characters": "style_suffix_char",
        "monsters": "style_suffix_monster",
        "decorations": "style_suffix_pixel",
    }
    asset["_suffix_key"] = suffix_map.get(category, "style_suffix_pixel")
    prompt = build_prompt(asset, meta)
    negative = get_negative_prompt(meta)

    print(f"  [gen] {name} ({target_size}x{target_size})")
    print(f"        prompt: {prompt[:80]}...")

    t0 = time.time()

    # Generate at 512×512 (SD 1.5 native resolution)
    gen_size = 512
    img = generate_image(pipe, prompt, negative, size=gen_size, seed=None)

    # Downscale to target size using nearest-neighbor
    if target_size != gen_size:
        img = downscale_nearest(img, target_size)

    img.save(out_path, "PNG")
    elapsed = time.time() - t0
    print(f"        saved: {out_path} ({elapsed:.1f}s)")


def generate_category(pipe, data: dict, category: str, output_base: Path):
    """Generate all assets in a category."""
    meta = data["_meta"]
    assets = data.get(category, [])
    if not assets:
        print(f"[warn] No assets found for category '{category}'")
        return

    print(f"\n{'='*60}")
    print(f"  Generating {len(assets)} {category}")
    print(f"{'='*60}")

    for i, asset in enumerate(assets):
        print(f"\n  [{i+1}/{len(assets)}]")
        generate_asset(pipe, asset, meta, output_base, category)


# ---------------------------------------------------------------------------
# Manifest generation
# ---------------------------------------------------------------------------
def generate_manifest(output_base: Path):
    """Scan output directory and generate manifest.json for the game to load."""
    manifest = {}
    for subdir in ["tiles", "characters", "monsters", "buildings"]:
        dir_path = output_base / subdir
        if dir_path.exists():
            files = sorted(f.stem for f in dir_path.glob("*.png"))
            manifest[subdir] = files

    manifest_path = output_base / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n[manifest] Written to {manifest_path}")
    print(f"  tiles: {len(manifest.get('tiles', []))}")
    print(f"  characters: {len(manifest.get('characters', []))}")
    print(f"  monsters: {len(manifest.get('monsters', []))}")
    print(f"  buildings: {len(manifest.get('buildings', []))}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="AI Asset Generator for 勇者傳說"
    )
    parser.add_argument("--test", action="store_true",
                        help="Generate 2-3 test images to verify quality")
    parser.add_argument("--all", action="store_true",
                        help="Generate all assets")
    parser.add_argument("--category", type=str,
                        choices=["tiles", "buildings", "characters", "monsters", "decorations"],
                        help="Generate a specific category")
    parser.add_argument("--name", type=str,
                        help="Generate a single asset by name")
    parser.add_argument("--turbo", action="store_true",
                        help="Use SD Turbo (1-step, faster but lower quality)")
    parser.add_argument("--output", type=str, default=str(OUTPUT_DIR),
                        help=f"Output directory (default: {OUTPUT_DIR})")
    parser.add_argument("--seed", type=int, default=None,
                        help="Random seed for reproducibility")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite existing images")
    parser.add_argument("--manifest-only", action="store_true",
                        help="Only regenerate the manifest.json without generating images")

    args = parser.parse_args()
    output_base = Path(args.output)

    # Load prompt definitions
    data = load_prompts()

    # Manifest-only mode
    if args.manifest_only:
        generate_manifest(output_base)
        return

    # Must specify at least one action
    if not (args.test or args.all or args.category or args.name):
        parser.print_help()
        sys.exit(1)

    # Load pipeline
    pipe = load_pipeline(turbo=args.turbo)

    if args.test:
        # Quick test: generate one tile and one monster
        meta = data["_meta"]
        test_assets = [
            (data["tiles"][0], "tiles"),      # tile_grass
            (data["monsters"][0], "monsters"), # mon_slime
        ]
        if len(data["buildings"]) > 0:
            test_assets.append((data["buildings"][0], "buildings"))  # bld_tudor

        print(f"\n[test] Generating {len(test_assets)} test images...")
        for asset, cat in test_assets:
            if args.force:
                out_path = output_base / ("tiles" if cat == "decorations" else cat) / f"{asset['name']}.png"
                if out_path.exists():
                    out_path.unlink()
            generate_asset(pipe, asset, meta, output_base, cat)

    elif args.name:
        # Find asset by name across all categories
        meta = data["_meta"]
        found = False
        for cat in ["tiles", "buildings", "characters", "monsters", "decorations"]:
            for asset in data.get(cat, []):
                if asset["name"] == args.name:
                    if args.force:
                        subdir = "tiles" if cat == "decorations" else cat
                        out_path = output_base / subdir / f"{asset['name']}.png"
                        if out_path.exists():
                            out_path.unlink()
                    generate_asset(pipe, asset, meta, output_base, cat)
                    found = True
                    break
            if found:
                break
        if not found:
            print(f"[error] Asset '{args.name}' not found in prompt definitions")
            sys.exit(1)

    elif args.category:
        if args.force:
            subdir = "tiles" if args.category == "decorations" else args.category
            dir_path = output_base / subdir
            if dir_path.exists():
                for f in dir_path.glob("*.png"):
                    f.unlink()
        generate_category(pipe, data, args.category, output_base)

    elif args.all:
        for cat in ["tiles", "buildings", "characters", "monsters", "decorations"]:
            generate_category(pipe, data, cat, output_base)

    # Generate manifest
    generate_manifest(output_base)

    print("\n[done] Asset generation complete!")


if __name__ == "__main__":
    main()
