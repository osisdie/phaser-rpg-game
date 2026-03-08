#!/usr/bin/env python3
"""
GPU Audio Generator for 勇者傳說 (Hero's Legend)
Designed for Google Colab T4 GPU (16GB VRAM).
MusicGen Large (3.3B) + segment chaining for loopable BGM up to 90s.
Output saves to Google Drive; interrupted runs resume automatically.

=== Colab Usage ===

    !pip install -q transformers accelerate scipy pydub
    !apt-get -qq install ffmpeg
    !python /content/repo/scripts/colab/generate_audio_gpu.py --all --chain-segments

    # 只產 BGM (60s 有 segment chaining):
    !python /content/repo/scripts/colab/generate_audio_gpu.py --category bgm --chain-segments

    # 只產 SFX:
    !python /content/repo/scripts/colab/generate_audio_gpu.py --category sfx

    # 中斷後重跑 → 自動跳過已完成的; 加 --force 全部重做

=== VRAM 預估 (T4 16GB) ===
    MusicGen Large fp16:  ~6 GB  (~10s per 30s segment)
    MusicGen Medium fp16: ~3 GB  (~6s per 30s segment)
    MusicGen Small fp32:  ~1.5 GB (CPU ok, ~60s per 30s segment)
"""

import argparse
import json
import os
import shutil
import subprocess
import sys
import time
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from colab_utils import (
    setup_colab, get_prompts_path,
    ProgressTracker, free_vram, print_vram_usage,
)

SAMPLE_RATE = 32000
TOKENS_PER_SECOND = 50
MAX_TOKENS = 1503  # ~30s per segment


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


# ---------------------------------------------------------------------------
# Pipeline
# ---------------------------------------------------------------------------
_pipe = None
_current_model = None


def load_pipeline(model_size: str = "large", device: str = "auto"):
    global _pipe, _current_model
    if _pipe is not None and _current_model == model_size:
        return _pipe

    import torch
    from transformers import pipeline

    hub_ids = {
        "large": "facebook/musicgen-large",
        "medium": "facebook/musicgen-medium",
        "small": "facebook/musicgen-small",
    }
    hub_id = hub_ids.get(model_size, hub_ids["large"])

    # Check local/Drive cache
    model_name = f"musicgen-{model_size}"
    local = Path(os.environ.get("MODELS_DIR", "/mnt/c/writable/models")) / model_name
    gdrive = Path("/content/drive/MyDrive/ai-rpg-game/models") / model_name

    if local.exists():
        model_path = str(local)
    elif gdrive.exists():
        model_path = str(gdrive)
        print(f"[cache] Google Drive: {gdrive}")
    else:
        model_path = hub_id
        print(f"[download] {hub_id}")

    actual_device = detect_device(device)
    dtype = torch.float16 if actual_device == "cuda" else torch.float32

    print(f"[pipeline] MusicGen {model_size.capitalize()} ({actual_device}, {dtype})...")
    t0 = time.time()

    _pipe = pipeline(
        "text-to-audio",
        model=model_path,
        device=actual_device,
        torch_dtype=dtype,
    )

    _current_model = model_size
    print(f"[pipeline] Ready in {time.time() - t0:.1f}s")
    print_vram_usage()
    return _pipe


# ---------------------------------------------------------------------------
# Segment chaining
# ---------------------------------------------------------------------------
def generate_segment(pipe, prompt: str, max_tokens: int) -> np.ndarray:
    result = pipe(prompt, forward_params={"max_new_tokens": max_tokens})
    return np.squeeze(result["audio"])


def crossfade(a: np.ndarray, b: np.ndarray, overlap: int) -> np.ndarray:
    overlap = min(overlap, len(a), len(b))
    if overlap <= 0:
        return np.concatenate([a, b])
    fade_out = np.linspace(1.0, 0.0, overlap)
    fade_in = np.linspace(0.0, 1.0, overlap)
    mixed = a[-overlap:] * fade_out + b[:overlap] * fade_in
    return np.concatenate([a[:-overlap], mixed, b[overlap:]])


def make_loop_seamless(audio: np.ndarray, fade_samples: int) -> np.ndarray:
    fade = min(fade_samples, len(audio) // 4)
    if fade <= 0:
        return audio
    result = audio.copy()
    fade_out = np.linspace(1.0, 0.0, fade)
    fade_in = np.linspace(0.0, 1.0, fade)
    result[:fade] = audio[:fade] * fade_in + audio[-fade:] * fade_out
    return result[:-fade]


def generate_chained_audio(pipe, prompt, total_duration, segment_duration=30,
                           crossfade_seconds=3.0, loop=True):
    segments = []
    remaining = total_duration
    idx = 0

    while remaining > 0:
        dur = min(remaining, segment_duration)
        tokens = min(dur * TOKENS_PER_SECOND, MAX_TOKENS)
        seg_prompt = f"{prompt}, continuation" if idx > 0 else prompt
        print(f"    [segment {idx+1}] {dur}s ({tokens} tokens)")
        segments.append(generate_segment(pipe, seg_prompt, tokens))
        remaining -= dur
        idx += 1

    overlap = int(crossfade_seconds * SAMPLE_RATE)
    combined = segments[0]
    for seg in segments[1:]:
        combined = crossfade(combined, seg, overlap)

    if loop and total_duration >= 30:
        combined = make_loop_seamless(combined, overlap)

    return combined


# ---------------------------------------------------------------------------
# Post-processing
# ---------------------------------------------------------------------------
def normalize_loudness(audio: np.ndarray, target_db: float = -14.0) -> np.ndarray:
    rms = np.sqrt(np.mean(audio ** 2))
    if rms < 1e-8:
        return audio
    target_rms = 10 ** (target_db / 20.0)
    return audio * (target_rms / rms)


def convert_to_ogg(wav_path: Path) -> Path | None:
    if not shutil.which("ffmpeg"):
        return None
    ogg_path = wav_path.with_suffix(".ogg")
    try:
        subprocess.run(
            ["ffmpeg", "-y", "-i", str(wav_path),
             "-c:a", "libvorbis", "-q:a", "4", str(ogg_path)],
            capture_output=True, check=True,
        )
        print(f"        ogg: {ogg_path.name} ({ogg_path.stat().st_size / 1024:.0f} KB)")
        return ogg_path
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------
def build_prompt(entry, meta, category):
    prefix = meta.get("sfx_prefix") if category == "sfx" else meta.get("style_prefix", "")
    return f"{prefix}, {entry['prompt']}"


def generate_entry(pipe, entry, meta, category, output_base,
                   chain_segments, tracker):
    """Generate a single audio entry. Returns True if generated."""
    name = entry["name"]
    duration = entry["duration"]
    subdir = "bgm" if category == "bgm" else "sfx"
    out_dir = output_base / "audio" / subdir
    wav_path = out_dir / f"{name}.wav"
    ogg_path = out_dir / f"{name}.ogg"

    # Resume check
    if tracker.is_done(name) and (ogg_path.exists() or wav_path.exists()):
        print(f"  [skip] {name} (completed)")
        return False

    out_dir.mkdir(parents=True, exist_ok=True)
    prompt = build_prompt(entry, meta, category)
    target_lufs = -14.0 if category == "bgm" else -10.0

    print(f"  [gen] {name} ({duration}s)")
    print(f"        prompt: {prompt[:80]}...")
    t0 = time.time()

    if chain_segments and category == "bgm" and duration > 30:
        print(f"        chaining: {duration}s in ~30s segments")
        audio = generate_chained_audio(pipe, prompt, duration)
    else:
        tokens = min(duration * TOKENS_PER_SECOND, MAX_TOKENS)
        print(f"        tokens: {tokens} (~{tokens // TOKENS_PER_SECOND}s)")
        audio = generate_segment(pipe, prompt, tokens)

    audio = normalize_loudness(audio, target_lufs)
    audio = np.clip(audio, -1.0, 1.0)

    import scipy.io.wavfile
    scipy.io.wavfile.write(str(wav_path), SAMPLE_RATE, (audio * 32767).astype(np.int16))

    elapsed = time.time() - t0
    file_size = wav_path.stat().st_size / 1024
    print(f"        saved: {wav_path.name} ({file_size:.0f} KB, {elapsed:.1f}s)")

    convert_to_ogg(wav_path)
    tracker.mark_done(name)
    free_vram()
    return True


def generate_category(pipe, data, category, output_base, chain_segments, force=False):
    meta = data.get("_meta", {})
    entries = data.get(category, [])
    if not entries:
        print(f"[warn] No entries for '{category}'")
        return

    tracker = ProgressTracker(f"audio_{category}", output_base)
    if force:
        tracker.completed.clear()

    remaining = sum(1 for e in entries if not tracker.is_done(e["name"]))
    print(f"\n{'='*60}")
    print(f"  {category}: {len(entries)} total, {remaining} to generate")
    print(f"{'='*60}")

    generated = 0
    for i, entry in enumerate(entries):
        print(f"\n  [{i+1}/{len(entries)}] {tracker.summary(len(entries))}")
        if generate_entry(pipe, entry, meta, category, output_base, chain_segments, tracker):
            generated += 1

    print(f"\n  Done: generated {generated}, skipped {len(entries) - generated}")


# ---------------------------------------------------------------------------
# Manifest
# ---------------------------------------------------------------------------
def generate_manifest(output_base):
    audio_dir = output_base / "audio"
    manifest = {"bgm": [], "sfx": []}

    for category in ["bgm", "sfx"]:
        cat_dir = audio_dir / category
        if not cat_dir.exists():
            continue
        for f in sorted(cat_dir.iterdir()):
            if f.suffix in (".ogg", ".wav"):
                name = f.stem
                ogg_exists = (cat_dir / f"{name}.ogg").exists()
                ext = "ogg" if ogg_exists else "wav"
                if not any(e["name"] == name for e in manifest[category]):
                    manifest[category].append({
                        "name": name,
                        "file": f"{category}/{name}.{ext}",
                    })

    manifest_path = audio_dir / "manifest.json"
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"\n[manifest] {manifest_path}")
    print(f"  bgm: {len(manifest['bgm'])} | sfx: {len(manifest['sfx'])}")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(
        description="GPU Audio Generator for 勇者傳說 (Colab T4)"
    )
    parser.add_argument("--model", type=str, default="large",
                        choices=["large", "medium", "small"],
                        help="MusicGen size (default: large)")
    parser.add_argument("--device", type=str, default="auto",
                        choices=["auto", "gpu", "cpu"])
    parser.add_argument("--category", type=str, choices=["bgm", "sfx"])
    parser.add_argument("--name", type=str, help="Single track by name")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--test", action="store_true",
                        help="Generate 1 BGM + 1 SFX")
    parser.add_argument("--force", action="store_true",
                        help="Ignore progress, regenerate all")
    parser.add_argument("--chain-segments", action="store_true",
                        help="Chain 30s segments for longer BGM")
    parser.add_argument("--manifest-only", action="store_true")

    args = parser.parse_args()
    output_base = setup_colab("Audio Generator")

    if args.manifest_only:
        generate_manifest(output_base)
        return

    if not (args.test or args.all or args.category or args.name):
        parser.print_help()
        sys.exit(1)

    prompts_path = get_prompts_path("audio_prompts.json")
    with open(prompts_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    pipe = load_pipeline(args.model, args.device)

    if args.test:
        meta = data.get("_meta", {})
        tracker = ProgressTracker("audio_test", output_base)
        if data.get("bgm"):
            generate_entry(pipe, data["bgm"][0], meta, "bgm", output_base,
                          args.chain_segments, tracker)
        if data.get("sfx"):
            generate_entry(pipe, data["sfx"][0], meta, "sfx", output_base,
                          False, tracker)

    elif args.name:
        meta = data.get("_meta", {})
        found = False
        for cat in ["bgm", "sfx"]:
            for entry in data.get(cat, []):
                if entry["name"] == args.name:
                    tracker = ProgressTracker(f"audio_{cat}", output_base)
                    if args.force:
                        tracker.completed.discard(args.name)
                    generate_entry(pipe, entry, meta, cat, output_base,
                                  args.chain_segments, tracker)
                    found = True
                    break
            if found:
                break
        if not found:
            print(f"[error] '{args.name}' not found")
            sys.exit(1)

    elif args.category:
        generate_category(pipe, data, args.category, output_base,
                         args.chain_segments, args.force)

    elif args.all:
        for cat in ["bgm", "sfx"]:
            generate_category(pipe, data, cat, output_base,
                            args.chain_segments, args.force)

    generate_manifest(output_base)
    print("\n[done] Audio generation complete!")


if __name__ == "__main__":
    main()
