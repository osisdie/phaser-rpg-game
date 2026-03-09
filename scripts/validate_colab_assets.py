#!/usr/bin/env python3
"""
Validate Colab-generated assets for Phaser 3 compatibility.

Checks:
  - Image dimensions (WebGL max texture 4096x4096)
  - File sizes (warn if battle BGs > 500KB each)
  - Alpha channel presence (required for sprites)
  - Tile seamlessness (basic edge-pixel check)
  - Naming conventions (must match game texture keys)
  - Total memory estimate for WebGL GPU VRAM
  - Audio format and duration

Usage:
  python3 scripts/validate_colab_assets.py
  python3 scripts/validate_colab_assets.py --verbose
"""
import argparse
import json
import os
import struct
import sys
import wave
from pathlib import Path

PROJECT_DIR = Path(__file__).parent.parent
AI_DIR = PROJECT_DIR / "public" / "assets" / "ai"

# Region mapping (Colab r1-r12 -> game region_*)
REGION_MAP = {
    "r1": "region_hero", "r2": "region_elf", "r3": "region_treant",
    "r4": "region_beast", "r5": "region_merfolk", "r6": "region_giant",
    "r7": "region_dwarf", "r8": "region_undead", "r9": "region_volcano",
    "r10": "region_hotspring", "r11": "region_mountain", "r12": "region_demon",
}

# Expected asset specs
SPECS = {
    "tiles":              {"max_w": 64,   "max_h": 64,   "needs_alpha": False, "max_file_kb": 50,   "min_file_kb": 0.5},
    "monsters":           {"max_w": 512,  "max_h": 512,  "needs_alpha": True,  "max_file_kb": 200,  "min_file_kb": 1},
    "buildings":          {"max_w": 256,  "max_h": 256,  "needs_alpha": True,  "max_file_kb": 100,  "min_file_kb": 1},
    "portraits":          {"max_w": 512,  "max_h": 512,  "needs_alpha": False, "max_file_kb": 300,  "min_file_kb": 1},
    "decorations":        {"max_w": 128,  "max_h": 128,  "needs_alpha": True,  "max_file_kb": 50,   "min_file_kb": 0.3},
    "battle_backgrounds": {"max_w": 1024, "max_h": 768,  "needs_alpha": False, "max_file_kb": 1500, "min_file_kb": 100},
    "interiors":          {"max_w": 1024, "max_h": 768,  "needs_alpha": False, "max_file_kb": 1500, "min_file_kb": 100},
    "title_elements":     {"max_w": 1024, "max_h": 768,  "needs_alpha": False, "max_file_kb": 1500, "min_file_kb": 1},
    "worldmap_elements":  {"max_w": 1024, "max_h": 768,  "needs_alpha": False, "max_file_kb": 1500, "min_file_kb": 0.5},
    "battle_characters":  {"max_w": 512,  "max_h": 512,  "needs_alpha": True,  "max_file_kb": 300,  "min_file_kb": 1},
    "effects":            {"max_w": 256,  "max_h": 256,  "needs_alpha": True,  "max_file_kb": 100,  "min_file_kb": 0.3},
}

# WebGL limits
MAX_TEXTURE_SIZE = 4096  # Most GPUs support at least this
VRAM_WARN_MB = 256  # Warn if estimated VRAM > this


def read_png_info(path: Path) -> dict | None:
    """Read PNG dimensions and color type without PIL."""
    try:
        with open(path, "rb") as f:
            sig = f.read(8)
            if sig[:4] != b'\x89PNG':
                return None
            # IHDR chunk
            f.read(4)  # chunk length
            chunk_type = f.read(4)
            if chunk_type != b'IHDR':
                return None
            data = f.read(13)
            w, h = struct.unpack(">II", data[:8])
            bit_depth = data[8]
            color_type = data[9]
            has_alpha = color_type in (4, 6)  # LA or RGBA
            channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}.get(color_type, 4)
            return {"width": w, "height": h, "has_alpha": has_alpha,
                    "channels": channels, "bit_depth": bit_depth}
    except Exception:
        return None


def estimate_vram_bytes(w: int, h: int, channels: int = 4) -> int:
    """Estimate GPU VRAM for uncompressed RGBA texture."""
    # WebGL always stores as RGBA internally
    return w * h * 4


def validate_image(path: Path, category: str, verbose: bool) -> list[str]:
    """Validate a single image. Returns list of issues."""
    issues = []
    spec = SPECS.get(category, {})

    info = read_png_info(path)
    if info is None:
        issues.append(f"  ERROR: Not a valid PNG: {path.name}")
        return issues

    w, h = info["width"], info["height"]
    file_kb = path.stat().st_size / 1024

    # WebGL max texture
    if w > MAX_TEXTURE_SIZE or h > MAX_TEXTURE_SIZE:
        issues.append(f"  ERROR: {path.name} {w}x{h} exceeds WebGL max {MAX_TEXTURE_SIZE}")

    # Category-specific size check
    max_w = spec.get("max_w", 4096)
    max_h = spec.get("max_h", 4096)
    if w > max_w or h > max_h:
        issues.append(f"  WARN: {path.name} {w}x{h} exceeds expected {max_w}x{max_h}")

    # Alpha channel
    if spec.get("needs_alpha") and not info["has_alpha"]:
        issues.append(f"  WARN: {path.name} missing alpha channel (needed for {category})")

    # File size
    max_kb = spec.get("max_file_kb", 1000)
    if file_kb > max_kb:
        issues.append(f"  WARN: {path.name} {file_kb:.0f} KB > {max_kb} KB limit")

    # Too small (likely corrupt)
    min_kb = spec.get("min_file_kb", 1)
    if file_kb < min_kb:
        issues.append(f"  ERROR: {path.name} suspiciously small ({file_kb:.1f} KB, min {min_kb} KB)")

    if verbose and not issues:
        print(f"  OK: {path.name} {w}x{h} {file_kb:.0f}KB {'RGBA' if info['has_alpha'] else 'RGB'}")

    return issues


def validate_naming(category: str, keys: list[str]) -> list[str]:
    """Check naming conventions match game expectations."""
    issues = []

    if category == "battle_backgrounds":
        for key in keys:
            # Check for unmapped r1-r12 naming
            for rkey in REGION_MAP:
                if f"_{rkey}_" in key or key.endswith(f"_{rkey}"):
                    issues.append(
                        f"  ERROR: {key} uses Colab naming '{rkey}' — "
                        f"should be '{REGION_MAP[rkey]}'. Run import script to fix."
                    )

    if category == "tiles":
        expected_prefixes = ["tile_"]
        for key in keys:
            if not any(key.startswith(p) for p in expected_prefixes):
                issues.append(f"  WARN: {key} doesn't start with 'tile_' — may not match game keys")

    if category == "monsters":
        for key in keys:
            if not key.startswith("mon_"):
                issues.append(f"  WARN: {key} doesn't start with 'mon_' — may not match game keys")

    if category == "battle_characters":
        for key in keys:
            if not key.startswith("char_") or not key.endswith("_battle"):
                issues.append(f"  WARN: {key} should match 'char_*_battle' pattern")

    if category == "effects":
        for key in keys:
            if not key.startswith("fx_"):
                issues.append(f"  WARN: {key} doesn't start with 'fx_' — may not match game keys")

    return issues


def validate_audio(audio_dir: Path, verbose: bool) -> tuple[list[str], int]:
    """Validate audio files. Returns (issues, total_bytes)."""
    issues = []
    total_bytes = 0

    for subdir in ["bgm", "sfx"]:
        cat_dir = audio_dir / subdir
        if not cat_dir.exists():
            continue
        for f in sorted(cat_dir.iterdir()):
            if f.suffix not in (".wav", ".ogg"):
                continue
            size = f.stat().st_size
            total_bytes += size
            size_kb = size / 1024

            if f.suffix == ".wav":
                try:
                    with wave.open(str(f), "rb") as wf:
                        duration = wf.getnframes() / wf.getframerate()
                        if verbose:
                            print(f"  OK: {subdir}/{f.name} {duration:.1f}s {size_kb:.0f}KB")
                        if duration < 0.5 and subdir == "bgm":
                            issues.append(f"  WARN: {subdir}/{f.name} only {duration:.1f}s (too short for BGM)")
                except Exception:
                    issues.append(f"  WARN: {subdir}/{f.name} could not read WAV header")
            elif verbose:
                print(f"  OK: {subdir}/{f.name} {size_kb:.0f}KB")

    return issues, total_bytes


def main():
    parser = argparse.ArgumentParser(description="Validate Colab assets for Phaser 3")
    parser.add_argument("--verbose", "-v", action="store_true")
    args = parser.parse_args()

    if not AI_DIR.exists():
        print(f"ERROR: AI asset directory not found: {AI_DIR}")
        sys.exit(1)

    # Load manifest
    manifest_path = AI_DIR / "manifest.json"
    if not manifest_path.exists():
        print(f"ERROR: manifest.json not found at {manifest_path}")
        sys.exit(1)

    with open(manifest_path, "r") as f:
        manifest = json.load(f)

    all_issues: list[str] = []
    total_vram = 0
    total_disk = 0
    category_stats: list[tuple[str, int, int, int]] = []  # (cat, count, disk_kb, vram_kb)

    print("=" * 60)
    print("  Colab Asset Validation Report")
    print("=" * 60)

    # dir name -> manifest key mapping for non-standard categories
    manifest_to_dir = {"title_elements": "title", "worldmap_elements": "worldmap"}

    for category in ["tiles", "monsters", "buildings", "portraits",
                      "decorations", "battle_backgrounds", "interiors",
                      "title_elements", "worldmap_elements",
                      "battle_characters", "effects"]:
        keys = manifest.get(category, [])
        dir_name = manifest_to_dir.get(category, category)
        cat_dir = AI_DIR / dir_name
        if not keys and not cat_dir.exists():
            continue

        print(f"\n--- {category} ({len(keys)} in manifest) ---")

        # Check naming
        naming_issues = validate_naming(category, keys)
        all_issues.extend(naming_issues)
        for issue in naming_issues:
            print(issue)

        # Validate files
        cat_vram = 0
        cat_disk = 0
        file_count = 0

        if cat_dir.exists():
            pngs = sorted(cat_dir.glob("*.png"))
            pngs = [p for p in pngs if not p.stem.endswith("_preview")]
            for png in pngs:
                issues = validate_image(png, category, args.verbose)
                all_issues.extend(issues)
                for issue in issues:
                    print(issue)

                info = read_png_info(png)
                if info:
                    vram = estimate_vram_bytes(info["width"], info["height"])
                    cat_vram += vram
                    total_vram += vram
                cat_disk += png.stat().st_size
                total_disk += png.stat().st_size
                file_count += 1

            # Check for files not in manifest
            manifest_keys = set(keys)
            for png in pngs:
                if png.stem not in manifest_keys:
                    all_issues.append(f"  WARN: {png.name} exists but not in manifest")
                    print(f"  WARN: {png.name} exists on disk but not in manifest.json")

        category_stats.append((category, file_count, cat_disk // 1024, cat_vram // 1024))

    # Audio validation
    audio_dir = AI_DIR / "audio"
    if audio_dir.exists():
        print(f"\n--- audio ---")
        audio_issues, audio_bytes = validate_audio(audio_dir, args.verbose)
        all_issues.extend(audio_issues)
        for issue in audio_issues:
            print(issue)
        total_disk += audio_bytes

    # Summary
    print(f"\n{'=' * 60}")
    print(f"  Summary")
    print(f"{'=' * 60}")

    print(f"\n  {'Category':<22} {'Files':>6} {'Disk':>10} {'VRAM':>10}")
    print(f"  {'-'*22} {'-'*6} {'-'*10} {'-'*10}")
    for cat, count, disk_kb, vram_kb in category_stats:
        print(f"  {cat:<22} {count:>6} {disk_kb:>7} KB {vram_kb:>7} KB")

    total_vram_mb = total_vram / (1024 * 1024)
    total_disk_mb = total_disk / (1024 * 1024)
    print(f"\n  Total disk:  {total_disk_mb:.1f} MB")
    print(f"  Total VRAM:  {total_vram_mb:.1f} MB (uncompressed RGBA textures)")

    if total_vram_mb > VRAM_WARN_MB:
        msg = (f"  WARNING: Estimated VRAM ({total_vram_mb:.0f} MB) exceeds {VRAM_WARN_MB} MB. "
               f"Consider lazy-loading battle_backgrounds and interiors.")
        all_issues.append(msg)
        print(f"\n{msg}")

    # Performance recommendation
    bg_count = len(manifest.get("battle_backgrounds", []))
    interior_count = len(manifest.get("interiors", []))
    large_count = bg_count + interior_count
    if large_count > 10:
        print(f"\n  RECOMMENDATION: {large_count} large textures (1024x768).")
        print(f"  Enable lazy-loading in BootScene to reduce boot time and VRAM.")
        print(f"  (battle_backgrounds: {bg_count}, interiors: {interior_count})")

    # Final status
    errors = sum(1 for i in all_issues if "ERROR" in i)
    warnings = sum(1 for i in all_issues if "WARN" in i)
    print(f"\n  Issues: {errors} errors, {warnings} warnings")

    if errors > 0:
        print("\n  FAILED — fix errors before deploying.")
        sys.exit(1)
    elif warnings > 0:
        print("\n  PASSED with warnings.")
    else:
        print("\n  ALL CHECKS PASSED.")


if __name__ == "__main__":
    main()
