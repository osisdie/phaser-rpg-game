#!/usr/bin/env bash
# 啟動監控伺服器 (port 9473)
set -euo pipefail

PORT=9473
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/monitor-server"

if lsof -ti:"$PORT" &>/dev/null; then
  echo "⚠  Port $PORT 已被佔用："
  lsof -i:"$PORT" | head -5
  echo ""
  echo "請先執行 bash scripts/stop_monitor.sh 停止服務，或手動結束程序。"
  exit 1
fi

if [ ! -d "$DIR/node_modules" ]; then
  echo "📦 安裝 monitor-server 依賴..."
  (cd "$DIR" && pnpm install)
fi

cleanup() {
  echo ""
  echo "正在停止監控伺服器..."
  exit 0
}
trap cleanup SIGINT SIGTERM

echo "🚀 啟動監控伺服器 (http://localhost:$PORT) ..."
(cd "$DIR" && pnpm run dev)
