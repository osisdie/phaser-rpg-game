#!/usr/bin/env bash
# ============================================================================
# Import Colab-generated assets into the game project.
#
# Usage:
#   bash scripts/import_colab_assets.sh <colab_output_dir>
#
# Example:
#   # After downloading zip from Colab and extracting:
#   bash scripts/import_colab_assets.sh ~/Downloads/environments_output
#   bash scripts/import_colab_assets.sh ~/Downloads/sprites_output
#   bash scripts/import_colab_assets.sh ~/Downloads/audio_output
#
# Or import all at once from a merged directory:
#   bash scripts/import_colab_assets.sh ~/Downloads/all_outputs
# ============================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
AI_DIR="$PROJECT_DIR/public/assets/ai"

# Region ID mapping: Colab uses r1-r12, game uses region_* keys
declare -A REGION_MAP=(
  [r1]=region_hero    [r2]=region_elf       [r3]=region_treant
  [r4]=region_beast   [r5]=region_merfolk   [r6]=region_giant
  [r7]=region_dwarf   [r8]=region_undead    [r9]=region_volcano
  [r10]=region_hotspring [r11]=region_mountain [r12]=region_demon
)

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <colab_output_directory>"
  echo ""
  echo "The output directory should contain one or more of:"
  echo "  tiles/            -> public/assets/ai/tiles/"
  echo "  battle_backgrounds/ -> public/assets/ai/battle_backgrounds/"
  echo "  interiors/        -> public/assets/ai/interiors/"
  echo "  monsters/         -> public/assets/ai/monsters/"
  echo "  buildings/        -> public/assets/ai/buildings/"
  echo "  portraits/        -> public/assets/ai/portraits/"
  echo "  decorations/      -> public/assets/ai/decorations/"
  echo "  audio/            -> public/assets/ai/audio/"
  exit 1
fi

SRC_DIR="$1"
if [[ ! -d "$SRC_DIR" ]]; then
  echo "ERROR: Directory not found: $SRC_DIR"
  exit 1
fi

imported=0
skipped=0

# Rename battle_bg files from r1-r12 to region_* keys
rename_region() {
  local filename="$1"
  local base
  base=$(basename "$filename" .png)

  for rkey in "${!REGION_MAP[@]}"; do
    local game_key="${REGION_MAP[$rkey]}"
    # Replace _r1_ or _r1. patterns (e.g., battle_bg_r1 -> battle_bg_region_hero)
    if [[ "$base" =~ _${rkey}(_|$) ]]; then
      echo "${base//_${rkey}/_${game_key}}"
      return
    fi
  done
  echo "$base"
}

copy_category() {
  local category="$1"
  local src="$SRC_DIR/$category"
  local dst="$AI_DIR/$category"

  if [[ ! -d "$src" ]]; then
    return
  fi

  mkdir -p "$dst"
  echo "=== $category ==="

  local count=0
  for f in "$src"/*.png "$src"/*.ogg "$src"/*.wav; do
    [[ -f "$f" ]] || continue

    local base
    base=$(basename "$f")

    # Skip preview files
    if [[ "$base" == *_preview.png ]]; then
      continue
    fi

    # Rename region keys for battle_backgrounds
    if [[ "$category" == "battle_backgrounds" ]]; then
      local ext="${base##*.}"
      local newname
      newname=$(rename_region "$base")
      base="${newname}.${ext}"
    fi

    local dest="$dst/$base"
    cp "$f" "$dest"
    echo "  + $base"
    count=$((count + 1))
    imported=$((imported + 1))
  done
  echo "  ($count files)"
}

# Copy each category
for cat in tiles battle_backgrounds interiors monsters buildings portraits decorations; do
  copy_category "$cat"
done

# Audio has subdirectories (bgm/ sfx/)
if [[ -d "$SRC_DIR/audio" ]]; then
  echo "=== audio ==="
  audio_count=0
  for subdir in bgm sfx; do
    src_sub="$SRC_DIR/audio/$subdir"
    dst_sub="$AI_DIR/audio/$subdir"
    if [[ -d "$src_sub" ]]; then
      mkdir -p "$dst_sub"
      for f in "$src_sub"/*.ogg "$src_sub"/*.wav; do
        [[ -f "$f" ]] || continue
        base=$(basename "$f")
        cp "$f" "$dst_sub/$base"
        echo "  + audio/$subdir/$base"
        audio_count=$((audio_count + 1))
        imported=$((imported + 1))
      done
    fi
  done
  # Copy audio manifest if exists
  if [[ -f "$SRC_DIR/audio/manifest.json" ]]; then
    cp "$SRC_DIR/audio/manifest.json" "$AI_DIR/audio/manifest.json"
    echo "  + audio/manifest.json"
  fi
  echo "  ($audio_count audio files)"
fi

echo ""
echo "=== Generating manifest.json ==="

# Generate unified manifest.json
python3 -c "
import json, os
from pathlib import Path

ai_dir = Path('$AI_DIR')
manifest = {}

categories = ['tiles', 'characters', 'monsters', 'buildings',
              'battle_backgrounds', 'portraits', 'interiors', 'decorations']

for cat in categories:
    cat_dir = ai_dir / cat
    if not cat_dir.exists():
        continue
    keys = sorted(
        f.stem for f in cat_dir.glob('*.png')
        if not f.stem.startswith('_') and not f.stem.endswith('_preview')
    )
    if keys:
        manifest[cat] = keys

manifest_path = ai_dir / 'manifest.json'
with open(manifest_path, 'w', encoding='utf-8') as f:
    json.dump(manifest, f, indent=2)

print(f'Manifest written: {manifest_path}')
for cat, keys in manifest.items():
    print(f'  {cat}: {len(keys)} assets')
"

echo ""
echo "Done! Imported $imported files."
echo ""
echo "Next steps:"
echo "  1. Restart dev server: bash scripts/force_restart_frontend.sh"
echo "  2. Check browser console for AI asset count"
echo "  3. Run validation: python3 scripts/validate_colab_assets.py"
