#!/usr/bin/env bash
# 強制重啟監控伺服器 (kill -9 + restart)
set -euo pipefail

PORT=9473
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)/monitor-server"

echo "🔄 強制重啟監控伺服器 (port $PORT)..."

# Step 1: kill LISTEN processes on port (ignore client connections like Chrome SYN_SENT)
PIDS=$(lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "⏹  強制終止 port $PORT 上的程序 (PID: $(echo "$PIDS" | tr '\n' ' '))"
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Step 2: kill any lingering tsx/monitor-server processes
TSX_PIDS=$(pgrep -f "tsx.*server\.ts" 2>/dev/null || true)
if [ -n "$TSX_PIDS" ]; then
  echo "⏹  清除殘留 tsx 程序 (PID: $(echo "$TSX_PIDS" | tr '\n' ' '))"
  echo "$TSX_PIDS" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Step 3: verify port is free (check LISTEN only, ignore client connections)
if lsof -ti:"$PORT" -sTCP:LISTEN &>/dev/null; then
  echo "❌ Port $PORT 仍被佔用，請手動檢查："
  lsof -i:"$PORT"
  exit 1
fi

# Step 4: install deps if needed
if [ ! -d "$DIR/node_modules" ]; then
  echo "📦 安裝 monitor-server 依賴..."
  (cd "$DIR" && pnpm install)
fi

# Step 5: restart in background
echo "🚀 啟動監控伺服器 (http://localhost:$PORT) ..."
cd "$DIR"
nohup pnpm run dev > /tmp/rpg-monitor.log 2>&1 &
NEW_PID=$!
sleep 2

# Step 6: wait for server to be ready
for i in $(seq 1 15); do
  if curl -sf --max-time 1 "http://localhost:$PORT/api/health" >/dev/null 2>&1; then
    echo "✅ 監控伺服器已啟動 (PID: $NEW_PID, port $PORT)"
    exit 0
  fi
  sleep 1
done

echo "⚠  伺服器啟動超時，請檢查 /tmp/rpg-monitor.log"
