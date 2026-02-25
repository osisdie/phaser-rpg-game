#!/usr/bin/env bash
# TypeScript 檢查 + Vite 建置
set -euo pipefail

echo "🔍 TypeScript 類型檢查..."
pnpm exec tsc --noEmit
echo "✅ TypeScript 檢查通過"

echo ""
echo "📦 Vite 建置..."
pnpm run build
echo "✅ 建置完成 — 產出在 dist/"
