#!/usr/bin/env bash
# ============================================================================
# Zip the public/ resources directory.
#
# Usage:
#   bash scripts/zip_public_resources.sh [output_path]
#
# Example:
#   bash scripts/zip_public_resources.sh                    # -> public_resources.zip (in project root)
#   bash scripts/zip_public_resources.sh ~/Downloads/public_backup.zip
# ============================================================================
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
PUBLIC_DIR="$PROJECT_DIR/public"
DEFAULT_OUTPUT="$PROJECT_DIR/public_resources.zip"

OUTPUT="${1:-$DEFAULT_OUTPUT}"

if [[ ! -d "$PUBLIC_DIR" ]]; then
  echo "ERROR: public/ directory not found: $PUBLIC_DIR"
  exit 1
fi

cd "$PROJECT_DIR"

if command -v zip &>/dev/null; then
  echo "Zipping public/ -> $OUTPUT"
  zip -rq "$OUTPUT" public -x "*.DS_Store" -x "*__MACOSX*"
else
  echo "zip not found, using tar.gz instead"
  OUTPUT="${OUTPUT%.zip}.tar.gz"
  tar --exclude='*.DS_Store' --exclude='*__MACOSX*' -czf "$OUTPUT" public
fi

echo "Done: $(du -h "$OUTPUT" | cut -f1)"
