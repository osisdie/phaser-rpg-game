#!/usr/bin/env python3
"""
AI Audio Generator for 勇者傳說 (Hero's Legend)
Uses MusicGen Small (facebook/musicgen-small) to generate BGM and SFX on CPU.

Usage:
    # Test with 1 BGM + 1 SFX
    python scripts/generate_audio.py --test

    # Generate specific category
    python scripts/generate_audio.py --category bgm
    python scripts/generate_audio.py --category sfx

    # Generate everything
    python scripts/generate_audio.py --all

    # Generate a single track by name
    python scripts/generate_audio.py --name title

    # Force overwrite existing files
    python scripts/generate_audio.py --all --force
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR = Path(__file__).parent
PROJECT_DIR = SCRIPT_DIR.parent
PROMPTS_FILE = SCRIPT_DIR / "audio_prompts.json"
OUTPUT_DIR = PROJECT_DIR / "public" / "assets" / "ai" / "audio"
MODELS_DIR = Path("/mnt/c/writable/models")
MUSICGEN_MODEL = MODELS_DIR / "musicgen-small"

# MusicGen generates at 32000 Hz; ~50 tokens per second of audio
SAMPLE_RATE = 32000
TOKENS_PER_SECOND = 50

# ---------------------------------------------------------------------------
# Prompt helpers
# ---------------------------------------------------------------------------
def load_prompts() -> dict:
    with open(PROMPTS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def build_prompt(entry: dict, meta: dict, category: str) -> str:
    """Compose the full prompt from prefix + entry prompt."""
    prefix = meta.get("sfx_prefix") if category == "sfx" else meta.get("style_prefix", "")
    return f"{prefix}, {entry['prompt']}"


def duration_to_tokens(duration_seconds: int) -> int:
    """Convert desired duration (seconds) to max_new_tokens for MusicGen."""
    # MusicGen Small: ~50 tokens/sec, max 1503 tokens (~30s)
    tokens = duration_seconds * TOKENS_PER_SECOND
    return min(tokens, 1503)


# ---------------------------------------------------------------------------
# Pipeline loader
# ---------------------------------------------------------------------------
_pipe = None


def load_pipeline():
    """Load MusicGen Small pipeline (cached across calls)."""
    global _pipe
    if _pipe is not None:
        return _pipe

    import torch
    from transformers import pipeline

    print("[pipeline] Loading MusicGen Small...")
    t0 = time.time()

    model_path = str(MUSICGEN_MODEL) if MUSICGEN_MODEL.exists() else "facebook/musicgen-small"
    if not MUSICGEN_MODEL.exists():
        print(f"[warn] Local model not found at {MUSICGEN_MODEL}, downloading from HF Hub...")

    _pipe = pipeline(
        "text-to-audio",
        model=model_path,
        device="cpu",
        dtype=torch.float32,
    )

    elapsed = time.time() - t0
    print(f"[pipeline] MusicGen loaded in {elapsed:.1f}s")
    return _pipe


# ---------------------------------------------------------------------------
# Audio generation
# ---------------------------------------------------------------------------
def generate_audio_file(
    pipe,
    prompt: str,
    max_new_tokens: int,
    output_path: Path,
):
    """Generate a single audio file using MusicGen."""
    import scipy.io.wavfile

    print(f"  [gen] {output_path.stem}")
    print(f"        prompt: {prompt[:80]}...")
    print(f"        tokens: {max_new_tokens} (~{max_new_tokens // TOKENS_PER_SECOND}s)")

    t0 = time.time()

    result = pipe(
        prompt,
        forward_params={"max_new_tokens": max_new_tokens},
    )

    import numpy as np

    # Pipeline returns {"audio": np.ndarray(samples,), "sampling_rate": int}
    audio_data = result["audio"]
    sampling_rate = result["sampling_rate"]

    # Squeeze any extra dims, ensure 1D mono, convert float32 → int16 for WAV
    audio_data = np.squeeze(audio_data)
    audio_data = np.clip(audio_data, -1.0, 1.0)
    audio_int16 = (audio_data * 32767).astype(np.int16)

    # Save WAV
    output_path.parent.mkdir(parents=True, exist_ok=True)
    scipy.io.wavfile.write(str(output_path), sampling_rate, audio_int16)

    elapsed = time.time() - t0
    file_size = output_path.stat().st_size / 1024
    print(f"        saved: {output_path} ({file_size:.0f} KB, {elapsed:.1f}s)")

    return output_path


def convert_to_ogg(wav_path: Path) -> Path | None:
    """Convert WAV to OGG using ffmpeg (if available). Returns OGG path or None."""
    if not shutil.which("ffmpeg"):
        return None

    ogg_path = wav_path.with_suffix(".ogg")
    try:
        subprocess.run(
            [
                "ffmpeg", "-y", "-i", str(wav_path),
                "-c:a", "libvorbis", "-q:a", "4",
                str(ogg_path),
            ],
            capture_output=True,
            check=True,
        )
        ogg_size = ogg_path.stat().st_size / 1024
        wav_size = wav_path.stat().st_size / 1024
        print(f"        ogg: {ogg_path.name} ({ogg_size:.0f} KB, {ogg_size/wav_size*100:.0f}% of WAV)")
        return ogg_path
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None


# ---------------------------------------------------------------------------
# Generation orchestrator
# ---------------------------------------------------------------------------
def generate_entry(pipe, entry: dict, meta: dict, category: str, force: bool = False):
    """Generate a single BGM or SFX entry."""
    name = entry["name"]
    duration = entry["duration"]
    subdir = "bgm" if category == "bgm" else "sfx"
    out_dir = OUTPUT_DIR / subdir

    wav_path = out_dir / f"{name}.wav"
    ogg_path = out_dir / f"{name}.ogg"

    # Skip if already exists (check both WAV and OGG)
    if not force and (ogg_path.exists() or wav_path.exists()):
        print(f"  [skip] {name} already exists")
        return

    # Remove old files if forcing
    if force:
        for p in [wav_path, ogg_path]:
            if p.exists():
                p.unlink()

    prompt = build_prompt(entry, meta, category)
    tokens = duration_to_tokens(duration)

    wav = generate_audio_file(pipe, prompt, tokens, wav_path)

    # Try to convert to OGG for smaller file size
    convert_to_ogg(wav)


def generate_category(pipe, data: dict, category: str, force: bool = False):
    """Generate all entries in a category."""
    meta = data["_meta"]
    entries = data.get(category, [])
    if not entries:
        print(f"[warn] No entries found for category '{category}'")
        return

    print(f"\n{'='*60}")
    print(f"  Generating {len(entries)} {category}")
    print(f"{'='*60}")

    for i, entry in enumerate(entries):
        print(f"\n  [{i+1}/{len(entries)}]")
        generate_entry(pipe, entry, meta, category, force)


# ---------------------------------------------------------------------------
# Manifest generation
# ---------------------------------------------------------------------------
def generate_manifest():
    """Scan output directory and generate audio manifest.json for the game."""
    manifest = {"bgm": [], "sfx": []}

    for category in ["bgm", "sfx"]:
        dir_path = OUTPUT_DIR / category
        if not dir_path.exists():
            continue

        for f in sorted(dir_path.iterdir()):
            if f.suffix in (".ogg", ".wav"):
                name = f.stem
                # Prefer OGG over WAV if both exist
                ogg_exists = (dir_path / f"{name}.ogg").exists()
                wav_exists = (dir_path / f"{name}.wav").exists()
                ext = "ogg" if ogg_exists else "wav"

                # Avoid duplicates (OGG + WAV for same name)
                if not any(e["name"] == name for e in manifest[category]):
                    manifest[category].append({
                        "name": name,
                        "file": f"{category}/{name}.{ext}",
                    })

    manifest_path = OUTPUT_DIR / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n[manifest] Written to {manifest_path}")
    print(f"  bgm: {len(manifest['bgm'])} tracks")
    print(f"  sfx: {len(manifest['sfx'])} effects")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="AI Audio Generator for 勇者傳說"
    )
    parser.add_argument("--test", action="store_true",
                        help="Generate 1 BGM + 1 SFX to verify quality")
    parser.add_argument("--all", action="store_true",
                        help="Generate all BGM and SFX")
    parser.add_argument("--category", type=str, choices=["bgm", "sfx"],
                        help="Generate a specific category")
    parser.add_argument("--name", type=str,
                        help="Generate a single track by name")
    parser.add_argument("--force", action="store_true",
                        help="Overwrite existing files")
    parser.add_argument("--manifest-only", action="store_true",
                        help="Only regenerate the manifest.json")

    args = parser.parse_args()

    # Load prompt definitions
    data = load_prompts()

    # Manifest-only mode
    if args.manifest_only:
        generate_manifest()
        return

    # Must specify at least one action
    if not (args.test or args.all or args.category or args.name):
        parser.print_help()
        sys.exit(1)

    # Load pipeline
    pipe = load_pipeline()

    if args.test:
        meta = data["_meta"]
        # Generate first BGM and first SFX as test
        test_entries = []
        if data.get("bgm"):
            test_entries.append((data["bgm"][0], "bgm"))
        if data.get("sfx"):
            test_entries.append((data["sfx"][0], "sfx"))

        print(f"\n[test] Generating {len(test_entries)} test audio files...")
        for entry, cat in test_entries:
            generate_entry(pipe, entry, meta, cat, force=args.force)

    elif args.name:
        meta = data["_meta"]
        found = False
        for cat in ["bgm", "sfx"]:
            for entry in data.get(cat, []):
                if entry["name"] == args.name:
                    generate_entry(pipe, entry, meta, cat, force=args.force)
                    found = True
                    break
            if found:
                break
        if not found:
            print(f"[error] Track '{args.name}' not found in prompt definitions")
            sys.exit(1)

    elif args.category:
        generate_category(pipe, data, args.category, force=args.force)

    elif args.all:
        for cat in ["bgm", "sfx"]:
            generate_category(pipe, data, cat, force=args.force)

    # Generate manifest
    generate_manifest()

    print("\n[done] Audio generation complete!")


if __name__ == "__main__":
    main()
