#!/usr/bin/env bash
# 檢查監控伺服器狀態
set -euo pipefail

PORT=9473
URL="http://localhost:$PORT"

echo "=== 監控伺服器狀態 (port $PORT) ==="

PIDS=$(lsof -ti:"$PORT" 2>/dev/null || true)

if [ -z "$PIDS" ]; then
  echo "❌ 沒有程序在 port $PORT 上運行"
  exit 0
fi

echo "✅ 運行中 (PID: $(echo "$PIDS" | tr '\n' ' '))"
lsof -i:"$PORT" | head -5

echo ""
echo "=== 健康檢查 ==="
if HEALTH=$(curl -sf --max-time 3 "$URL/api/health" 2>/dev/null); then
  echo "✅ $HEALTH"
else
  echo "⚠  $URL 無法連線（伺服器可能尚在啟動中）"
fi
