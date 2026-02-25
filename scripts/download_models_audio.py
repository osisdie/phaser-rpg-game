#!/usr/bin/env python3
"""
Download audio generation model for 勇者傳說 (Hero's Legend).
Uses huggingface_hub Python API for reliability.

Model downloaded:
  - MusicGen Small (300M params, ~1.2 GB)

Also installs required dependency:
  - scipy (for WAV output)

Usage:
    python scripts/download_models_audio.py
"""

import os
import shutil
import subprocess
from pathlib import Path

# ---------------------------------------------------------------------------
# Shared constants (same across image / audio download scripts)
# ---------------------------------------------------------------------------
MODELS_DIR = Path("/mnt/c/writable/models")
VENV_DIR = MODELS_DIR / "sd-venv"
MUSICGEN_DIR = MODELS_DIR / "musicgen-small"

# Use Linux-native HF cache to avoid .lock hangs on WSL + NTFS (/mnt/c/)
os.environ.setdefault("HF_HUB_CACHE", os.path.expanduser("~/.cache/huggingface_hub"))


def install_scipy():
    """Ensure scipy is installed (required for WAV output from MusicGen)."""
    try:
        import scipy  # noqa: F401
        print("  scipy already installed.")
    except ImportError:
        print("  Installing scipy...")
        pip_exe = str(VENV_DIR / "bin" / "pip")
        subprocess.check_call(
            [pip_exe, "install", "--quiet", "scipy"],
            stdout=subprocess.DEVNULL,
        )
        print("  scipy installed.")


def main():
    from huggingface_hub import snapshot_download

    print("=" * 50)
    print("  Audio Model Download for 勇者傳說")
    print(f"  Target: {MUSICGEN_DIR}")
    print(f"  HF cache: {os.environ['HF_HUB_CACHE']}")
    print("=" * 50)

    # 1. Install scipy dependency
    print("\n[1/2] Checking scipy dependency...")
    install_scipy()

    # 2. Download MusicGen Small (~2.4 GB model weights)
    # Check for model weights (config.json alone = incomplete download)
    model_complete = (
        (MUSICGEN_DIR / "model.safetensors").exists()
        or (MUSICGEN_DIR / "pytorch_model.bin").exists()
    )
    print("\n[2/2] MusicGen Small (~2.4 GB)...")
    if model_complete:
        print("  Already exists, skipping.")
    else:
        # Download to /tmp first to avoid .gitignore.lock hangs on WSL+NTFS
        import tempfile
        tmp_dir = Path(tempfile.mkdtemp(prefix="hf_musicgen_"))
        try:
            print(f"  Downloading to {tmp_dir} (then copying)...")
            snapshot_download(
                "facebook/musicgen-small",
                local_dir=str(tmp_dir),
            )
            MUSICGEN_DIR.mkdir(parents=True, exist_ok=True)
            for f in tmp_dir.iterdir():
                if f.name != ".cache":
                    dest = MUSICGEN_DIR / f.name
                    if f.is_dir():
                        shutil.copytree(f, dest, dirs_exist_ok=True)
                    else:
                        shutil.copy2(f, dest)
        finally:
            shutil.rmtree(tmp_dir, ignore_errors=True)
        print("  Done.")

    print("\n" + "=" * 50)
    print("  Audio model download complete!")
    print()
    print("  Next step: Generate test audio:")
    print(f"  {VENV_DIR / 'bin' / 'python'} scripts/generate_audio.py --test")
    print("=" * 50)


if __name__ == "__main__":
    main()
