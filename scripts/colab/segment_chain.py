#!/usr/bin/env python3
"""
Audio Segment Chaining Utility for 勇者傳說 (Hero's Legend)
Standalone utility for chaining multiple audio segments into loopable tracks.
Can be used independently of the generation pipeline for post-processing.

Usage:
    # Chain two WAV files with 3s crossfade
    python scripts/colab/segment_chain.py seg1.wav seg2.wav -o output.wav

    # Chain with loop point
    python scripts/colab/segment_chain.py seg1.wav seg2.wav -o output.wav --loop

    # Normalize to -14 LUFS
    python scripts/colab/segment_chain.py input.wav -o output.wav --normalize -14
"""

import argparse
import sys
from pathlib import Path

import numpy as np


def load_wav(path: Path) -> tuple[np.ndarray, int]:
    """Load a WAV file, return (audio_float32, sample_rate)."""
    import scipy.io.wavfile
    sr, data = scipy.io.wavfile.read(str(path))
    # Convert to float32
    if data.dtype == np.int16:
        data = data.astype(np.float32) / 32767.0
    elif data.dtype == np.int32:
        data = data.astype(np.float32) / 2147483647.0
    elif data.dtype != np.float32:
        data = data.astype(np.float32)
    # Mono
    if data.ndim > 1:
        data = data.mean(axis=1)
    return data, sr


def save_wav(path: Path, audio: np.ndarray, sr: int = 32000):
    """Save audio as int16 WAV."""
    import scipy.io.wavfile
    audio = np.clip(audio, -1.0, 1.0)
    audio_int16 = (audio * 32767).astype(np.int16)
    path.parent.mkdir(parents=True, exist_ok=True)
    scipy.io.wavfile.write(str(path), sr, audio_int16)


def crossfade(a: np.ndarray, b: np.ndarray, overlap: int) -> np.ndarray:
    """Crossfade two segments with linear ramp."""
    overlap = min(overlap, len(a), len(b))
    if overlap <= 0:
        return np.concatenate([a, b])

    fade_out = np.linspace(1.0, 0.0, overlap)
    fade_in = np.linspace(0.0, 1.0, overlap)

    mixed = a[-overlap:] * fade_out + b[:overlap] * fade_in
    return np.concatenate([a[:-overlap], mixed, b[overlap:]])


def make_loopable(audio: np.ndarray, fade_samples: int) -> np.ndarray:
    """Crossfade end into beginning for seamless looping."""
    fade_samples = min(fade_samples, len(audio) // 4)
    if fade_samples <= 0:
        return audio

    fade_out = np.linspace(1.0, 0.0, fade_samples)
    fade_in = np.linspace(0.0, 1.0, fade_samples)

    result = audio.copy()
    result[:fade_samples] = audio[:fade_samples] * fade_in + audio[-fade_samples:] * fade_out
    return result[:-fade_samples]


def normalize_rms(audio: np.ndarray, target_db: float = -14.0) -> np.ndarray:
    """Simple RMS normalization (approximates LUFS)."""
    rms = np.sqrt(np.mean(audio ** 2))
    if rms < 1e-8:
        return audio
    target_rms = 10 ** (target_db / 20.0)
    return audio * (target_rms / rms)


def main():
    parser = argparse.ArgumentParser(description="Audio Segment Chaining Utility")
    parser.add_argument("inputs", nargs="+", type=str,
                        help="Input WAV files to chain")
    parser.add_argument("-o", "--output", type=str, required=True,
                        help="Output WAV path")
    parser.add_argument("--crossfade", type=float, default=3.0,
                        help="Crossfade duration in seconds (default: 3.0)")
    parser.add_argument("--loop", action="store_true",
                        help="Make output seamlessly loopable")
    parser.add_argument("--normalize", type=float, default=None,
                        help="Normalize to target dB (e.g., -14)")

    args = parser.parse_args()

    # Load all segments
    segments = []
    sr = 32000
    for inp in args.inputs:
        p = Path(inp)
        if not p.exists():
            print(f"[error] File not found: {p}")
            sys.exit(1)
        audio, file_sr = load_wav(p)
        sr = file_sr
        segments.append(audio)
        print(f"  loaded: {p.name} ({len(audio) / sr:.1f}s)")

    # Chain
    overlap_samples = int(args.crossfade * sr)
    if len(segments) == 1:
        combined = segments[0]
    else:
        combined = segments[0]
        for seg in segments[1:]:
            combined = crossfade(combined, seg, overlap_samples)
        print(f"  chained: {len(combined) / sr:.1f}s total")

    # Normalize
    if args.normalize is not None:
        combined = normalize_rms(combined, args.normalize)
        print(f"  normalized to {args.normalize} dB")

    # Loop
    if args.loop:
        loop_fade = int(args.crossfade * sr)
        combined = make_loopable(combined, loop_fade)
        print(f"  loop-ready: {len(combined) / sr:.1f}s")

    # Save
    out_path = Path(args.output)
    save_wav(out_path, combined, sr)
    print(f"  saved: {out_path} ({out_path.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
