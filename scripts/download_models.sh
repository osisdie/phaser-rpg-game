#!/bin/bash
# Download all AI models for 勇者傳說 (Hero's Legend)
# Unified entry point — delegates to Python scripts for reliability.
#
# Usage: bash scripts/download_models.sh
#
# Prerequisites:
#   Python venv at /mnt/c/writable/models/sd-venv with huggingface-hub installed

set -e

MODELS_DIR="/mnt/c/writable/models"
VENV_PYTHON="${MODELS_DIR}/sd-venv/bin/python"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "${VENV_PYTHON}" ]; then
    echo "Error: Python venv not found at ${MODELS_DIR}/sd-venv"
    echo "  Create it with: python3 -m venv ${MODELS_DIR}/sd-venv"
    echo "  Then: ${MODELS_DIR}/sd-venv/bin/pip install huggingface-hub"
    exit 1
fi

echo "============================================"
echo "  AI Model Download for 勇者傳說"
echo "============================================"
echo ""

# 1. Image generation models (SD 1.5 + LoRAs)
echo ">>> Downloading image models..."
"${VENV_PYTHON}" "${SCRIPT_DIR}/download_models_image.py"

echo ""

# 2. Audio generation model (MusicGen Small)
echo ">>> Downloading audio model..."
"${VENV_PYTHON}" "${SCRIPT_DIR}/download_models_audio.py"

echo ""
echo "============================================"
echo "  All models downloaded!"
echo ""
echo "  Generate test images:"
echo "    ${VENV_PYTHON} scripts/generate_assets.py --test"
echo ""
echo "  Generate test audio:"
echo "    ${VENV_PYTHON} scripts/generate_audio.py --test"
echo "============================================"
