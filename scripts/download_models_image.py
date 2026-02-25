#!/usr/bin/env python3
"""
Download image generation models for 勇者傳說 (Hero's Legend).
Uses huggingface_hub Python API instead of CLI for reliability.

Models downloaded:
  - SD 1.5 base (~4.1 GB)
  - LCM-LoRA for 4-step inference (~134 MB)
  - PixelArt LoRA for style (~27 MB)

Usage:
    python scripts/download_models_image.py
"""

import os
import sys
from pathlib import Path

# ---------------------------------------------------------------------------
# Shared constants (same across image / audio download scripts)
# ---------------------------------------------------------------------------
MODELS_DIR = Path("/mnt/c/writable/models")

# Use Linux-native HF cache to avoid .lock hangs on WSL + NTFS (/mnt/c/)
os.environ.setdefault("HF_HUB_CACHE", os.path.expanduser("~/.cache/huggingface_hub"))


def main():
    from huggingface_hub import snapshot_download

    print("=" * 50)
    print("  Image Model Download for 勇者傳說")
    print(f"  Target: {MODELS_DIR}")
    print(f"  HF cache: {os.environ['HF_HUB_CACHE']}")
    print("=" * 50)

    # 1. SD 1.5 base model (~4.1 GB)
    sd15_dir = MODELS_DIR / "stable-diffusion-v1-5"
    print("\n[1/3] SD 1.5 base model (~4.1 GB)...")
    if (sd15_dir / "model_index.json").exists() and (sd15_dir / "vae").is_dir():
        print("  Already exists, skipping.")
    else:
        snapshot_download(
            "runwayml/stable-diffusion-v1-5",
            local_dir=str(sd15_dir),
        )
        print("  Done.")

    # 2. LCM-LoRA (~134 MB)
    lcm_dir = MODELS_DIR / "lcm-lora-sdv1-5"
    print("\n[2/3] LCM-LoRA (~134 MB)...")
    if (lcm_dir / "pytorch_lora_weights.safetensors").exists():
        print("  Already exists, skipping.")
    else:
        snapshot_download(
            "latent-consistency/lcm-lora-sdv1-5",
            local_dir=str(lcm_dir),
        )
        print("  Done.")

    # 3. PixelArt LoRA (~27 MB)
    pixel_dir = MODELS_DIR / "loras" / "pixelart-redmond-15v"
    print("\n[3/3] PixelArt LoRA (~27 MB)...")
    if any(pixel_dir.glob("*.safetensors")) if pixel_dir.exists() else False:
        print("  Already exists, skipping.")
    else:
        pixel_dir.mkdir(parents=True, exist_ok=True)
        snapshot_download(
            "artificialguybr/pixelartredmond-1-5v-pixel-art-loras-for-sd-1-5",
            local_dir=str(pixel_dir),
        )
        print("  Done.")

    print("\n" + "=" * 50)
    print("  Image model download complete!")
    print("=" * 50)


if __name__ == "__main__":
    main()
