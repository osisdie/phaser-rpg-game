#!/usr/bin/env python3
"""
Procedural SFX Synthesizer for 勇者傳說 (Hero's Legend)
Generates clean, precise game sound effects using numpy waveforms.

Usage:
    python scripts/generate_sfx_synth.py          # Generate all SFX
    python scripts/generate_sfx_synth.py --name sfx_select  # Generate one
    python scripts/generate_sfx_synth.py --list    # List available SFX
"""

import argparse
import json
import sys
from pathlib import Path

import numpy as np
import scipy.io.wavfile

SAMPLE_RATE = 44100
OUTPUT_DIR = Path(__file__).parent.parent / "public" / "assets" / "ai" / "audio" / "sfx"
MANIFEST_DIR = Path(__file__).parent.parent / "public" / "assets" / "ai" / "audio"


# ─── Waveform primitives ───

def sine(freq: float, duration: float, sr: int = SAMPLE_RATE) -> np.ndarray:
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    return np.sin(2 * np.pi * freq * t)


def square(freq: float, duration: float, sr: int = SAMPLE_RATE) -> np.ndarray:
    return np.sign(sine(freq, duration, sr))


def triangle(freq: float, duration: float, sr: int = SAMPLE_RATE) -> np.ndarray:
    t = np.linspace(0, duration, int(sr * duration), endpoint=False)
    return 2 * np.abs(2 * (t * freq - np.floor(t * freq + 0.5))) - 1


def noise(duration: float, sr: int = SAMPLE_RATE) -> np.ndarray:
    return np.random.uniform(-1, 1, int(sr * duration))


# ─── Envelope ───

def adsr(length: int, attack: float, decay: float, sustain_level: float,
         release: float, sr: int = SAMPLE_RATE) -> np.ndarray:
    """ADSR envelope. Times in seconds."""
    a = int(attack * sr)
    d = int(decay * sr)
    r = int(release * sr)
    s = max(0, length - a - d - r)

    env = np.concatenate([
        np.linspace(0, 1, a, endpoint=False),           # Attack
        np.linspace(1, sustain_level, d, endpoint=False), # Decay
        np.full(s, sustain_level),                        # Sustain
        np.linspace(sustain_level, 0, r, endpoint=False), # Release
    ])
    # Pad or trim to exact length
    if len(env) < length:
        env = np.concatenate([env, np.zeros(length - len(env))])
    return env[:length]


def exp_decay(length: int, decay_rate: float = 10.0, sr: int = SAMPLE_RATE) -> np.ndarray:
    """Exponential decay envelope."""
    t = np.linspace(0, length / sr, length, endpoint=False)
    return np.exp(-decay_rate * t)


def bandpass_filter(signal: np.ndarray, low: float, high: float,
                    sr: int = SAMPLE_RATE) -> np.ndarray:
    """Simple FFT bandpass filter."""
    fft = np.fft.rfft(signal)
    freqs = np.fft.rfftfreq(len(signal), 1.0 / sr)
    mask = (freqs >= low) & (freqs <= high)
    fft[~mask] = 0
    return np.fft.irfft(fft, len(signal))


def normalize(signal: np.ndarray, peak: float = 0.9) -> np.ndarray:
    mx = np.max(np.abs(signal))
    if mx > 0:
        signal = signal * (peak / mx)
    return signal


def to_int16(signal: np.ndarray) -> np.ndarray:
    return (np.clip(signal, -1.0, 1.0) * 32767).astype(np.int16)


# ─── SFX definitions ───

def sfx_select() -> np.ndarray:
    """Menu select: bright two-note ascending chime (classic JRPG ピッ)"""
    dur = 0.12
    # Note 1: A5 (880Hz), quick
    n1 = sine(880, 0.05) * exp_decay(int(SAMPLE_RATE * 0.05), 25)
    # Note 2: E6 (1319Hz), slightly longer with ring
    n2 = sine(1319, 0.07) * exp_decay(int(SAMPLE_RATE * 0.07), 15)
    # Add subtle overtone for brightness
    n2 += 0.3 * sine(2638, 0.07) * exp_decay(int(SAMPLE_RATE * 0.07), 30)
    # Combine with slight gap
    gap = np.zeros(int(SAMPLE_RATE * 0.01))
    signal = np.concatenate([n1, gap, n2])
    # Short tail silence
    signal = np.concatenate([signal, np.zeros(int(SAMPLE_RATE * 0.03))])
    return normalize(signal, 0.8)


def sfx_cancel() -> np.ndarray:
    """Menu cancel: quick descending two-note (classic ブッ)"""
    # Note 1: E5 (659Hz)
    n1 = triangle(659, 0.06) * exp_decay(int(SAMPLE_RATE * 0.06), 20)
    # Note 2: B4 (494Hz), lower
    n2 = triangle(494, 0.08) * exp_decay(int(SAMPLE_RATE * 0.08), 12)
    gap = np.zeros(int(SAMPLE_RATE * 0.01))
    signal = np.concatenate([n1, gap, n2])
    signal = np.concatenate([signal, np.zeros(int(SAMPLE_RATE * 0.03))])
    return normalize(signal, 0.7)


def sfx_hit() -> np.ndarray:
    """Sword hit: sharp impact = noise burst + low thump"""
    dur = 0.18
    n = int(SAMPLE_RATE * dur)

    # Noise burst (filtered to mid-range for metallic feel)
    raw_noise = noise(dur)
    filtered = bandpass_filter(raw_noise, 800, 4000)
    noise_env = exp_decay(n, 25)
    impact = filtered * noise_env * 0.7

    # Low frequency thump (body of the hit)
    thump = sine(90, dur) * exp_decay(n, 20) * 0.5

    # High metallic ring
    ring = sine(2200, dur) * exp_decay(n, 35) * 0.15

    signal = impact + thump + ring
    signal = np.concatenate([signal, np.zeros(int(SAMPLE_RATE * 0.02))])
    return normalize(signal, 0.85)


def sfx_magic() -> np.ndarray:
    """Magic cast: ascending shimmer with harmonics"""
    dur = 0.4
    n = int(SAMPLE_RATE * dur)
    t = np.linspace(0, dur, n, endpoint=False)

    # Ascending frequency sweep (C6 to C7)
    freq_start, freq_end = 1047, 2093
    freq = freq_start + (freq_end - freq_start) * (t / dur) ** 0.7
    phase = np.cumsum(2 * np.pi * freq / SAMPLE_RATE)
    sweep = np.sin(phase) * 0.5

    # Sparkle: high-frequency sine bursts at random intervals
    sparkle = np.zeros(n)
    for i in range(6):
        pos = int(n * i / 6)
        spark_freq = 3000 + i * 400
        spark_dur = int(SAMPLE_RATE * 0.05)
        end = min(pos + spark_dur, n)
        actual_dur = end - pos
        sparkle[pos:end] = (sine(spark_freq, actual_dur / SAMPLE_RATE) *
                            exp_decay(actual_dur, 40) * 0.25)

    # Base shimmer (detuned pair for chorus effect)
    shimmer1 = sine(1047, dur) * 0.2
    shimmer2 = sine(1055, dur) * 0.2  # Slightly detuned

    # Envelope
    env = adsr(n, 0.02, 0.05, 0.6, 0.15)

    signal = (sweep + sparkle + shimmer1 + shimmer2) * env
    signal = np.concatenate([signal, np.zeros(int(SAMPLE_RATE * 0.05))])
    return normalize(signal, 0.75)


def sfx_heal() -> np.ndarray:
    """Healing: warm ascending arpeggio with gentle chime"""
    dur = 0.5
    notes = [523, 659, 784, 1047]  # C5, E5, G5, C6 (C major arpeggio)
    parts = []
    for i, freq in enumerate(notes):
        note_dur = 0.1 if i < 3 else 0.2
        n = int(SAMPLE_RATE * note_dur)
        tone = sine(freq, note_dur) * 0.6
        # Add octave overtone for warmth
        tone += sine(freq * 2, note_dur) * 0.15
        env = adsr(n, 0.005, 0.02, 0.7, 0.03)
        parts.append(tone * env)
    signal = np.concatenate(parts)
    signal = np.concatenate([signal, np.zeros(int(SAMPLE_RATE * 0.05))])
    return normalize(signal, 0.75)


SFX_GENERATORS = {
    "sfx_select": sfx_select,
    "sfx_cancel": sfx_cancel,
    "sfx_hit": sfx_hit,
    "sfx_magic": sfx_magic,
    "sfx_heal": sfx_heal,
}


# ─── File output ───

def save_wav(name: str, signal: np.ndarray) -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    path = OUTPUT_DIR / f"{name}.wav"
    scipy.io.wavfile.write(str(path), SAMPLE_RATE, to_int16(signal))
    size_kb = path.stat().st_size / 1024
    dur_ms = len(signal) / SAMPLE_RATE * 1000
    print(f"  [saved] {path.name} ({dur_ms:.0f}ms, {size_kb:.1f} KB)")
    return path


def update_manifest():
    """Update the audio manifest.json."""
    manifest = {"bgm": [], "sfx": []}
    for category in ["bgm", "sfx"]:
        dir_path = MANIFEST_DIR / category
        if not dir_path.exists():
            continue
        for f in sorted(dir_path.iterdir()):
            if f.suffix in (".ogg", ".wav"):
                name = f.stem
                ogg_exists = (dir_path / f"{name}.ogg").exists()
                ext = "ogg" if ogg_exists else "wav"
                if not any(e["name"] == name for e in manifest[category]):
                    manifest[category].append({
                        "name": name,
                        "file": f"{category}/{name}.{ext}",
                    })
    manifest_path = MANIFEST_DIR / "manifest.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    print(f"\n[manifest] Updated: {len(manifest['bgm'])} BGM, {len(manifest['sfx'])} SFX")


# ─── CLI ───

def main():
    parser = argparse.ArgumentParser(description="Procedural SFX Synthesizer for 勇者傳說")
    parser.add_argument("--name", type=str, help="Generate a specific SFX by name")
    parser.add_argument("--list", action="store_true", help="List available SFX")
    args = parser.parse_args()

    if args.list:
        print("Available SFX:")
        for name in SFX_GENERATORS:
            print(f"  - {name}")
        return

    if args.name:
        if args.name not in SFX_GENERATORS:
            print(f"[error] Unknown SFX: {args.name}")
            print(f"Available: {', '.join(SFX_GENERATORS.keys())}")
            sys.exit(1)
        names = [args.name]
    else:
        names = list(SFX_GENERATORS.keys())

    print(f"Generating {len(names)} SFX...")
    for name in names:
        signal = SFX_GENERATORS[name]()
        save_wav(name, signal)

    update_manifest()
    print("\n[done] SFX synthesis complete!")


if __name__ == "__main__":
    main()
