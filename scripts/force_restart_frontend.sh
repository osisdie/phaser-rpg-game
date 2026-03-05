#!/usr/bin/env bash
# 強制重啟前端開發伺服器 (kill -9 + restart)
set -euo pipefail

PORT=5473
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔄 強制重啟前端伺服器 (port $PORT)..."

# Step 1: kill LISTEN processes on port (ignore client connections like Chrome SYN_SENT)
PIDS=$(lsof -ti:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$PIDS" ]; then
  echo "⏹  強制終止 port $PORT 上的程序 (PID: $(echo "$PIDS" | tr '\n' ' '))"
  echo "$PIDS" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Step 2: kill any lingering vite processes
VITE_PIDS=$(pgrep -f "vite.*--port.*$PORT" 2>/dev/null || pgrep -f "vite" 2>/dev/null || true)
if [ -n "$VITE_PIDS" ]; then
  echo "⏹  清除殘留 vite 程序 (PID: $(echo "$VITE_PIDS" | tr '\n' ' '))"
  echo "$VITE_PIDS" | xargs kill -9 2>/dev/null || true
  sleep 1
fi

# Step 3: verify port is free (check LISTEN only, ignore client connections)
if lsof -ti:"$PORT" -sTCP:LISTEN &>/dev/null; then
  echo "❌ Port $PORT 仍被佔用，請手動檢查："
  lsof -i:"$PORT"
  exit 1
fi

# Step 4: restart in background
echo "🚀 啟動前端伺服器 (http://localhost:$PORT) ..."
cd "$PROJECT_DIR"
nohup npx vite --port "$PORT" > /tmp/rpg-vite.log 2>&1 &
NEW_PID=$!

# Step 5: wait for server to be ready
for i in $(seq 1 10); do
  if curl -sf --max-time 1 "http://localhost:$PORT" >/dev/null 2>&1; then
    echo "✅ 前端伺服器已啟動 (PID: $NEW_PID, port $PORT)"
    exit 0
  fi
  sleep 1
done

echo "⚠  伺服器啟動超時，請檢查 /tmp/rpg-vite.log"
