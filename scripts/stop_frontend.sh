#!/usr/bin/env bash
# 停止 port 5473 上的所有服務
set -euo pipefail

PORT=5473

PIDS=$(lsof -ti:"$PORT" 2>/dev/null || true)

if [ -z "$PIDS" ]; then
  echo "ℹ  No running service on port $PORT."
  exit 0
fi

echo "$PIDS" | xargs kill
echo "✅ 已停止 port $PORT 上的程序 (PID: $(echo "$PIDS" | tr '\n' ' '))"
