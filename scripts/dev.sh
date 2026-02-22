#!/usr/bin/env bash
# 啟動開發伺服器 (port 5473)
set -euo pipefail

PORT=5473

if lsof -ti:"$PORT" &>/dev/null; then
  echo "⚠  Port $PORT 已被佔用："
  lsof -i:"$PORT" | head -5
  echo ""
  echo "請先執行 bash scripts/stop.sh 停止服務，或手動結束程序。"
  exit 1
fi

cleanup() {
  echo ""
  echo "正在停止開發伺服器..."
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "🚀 啟動開發伺服器 (http://localhost:$PORT) ..."
pnpm run dev
