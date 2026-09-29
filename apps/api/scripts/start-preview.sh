#!/bin/bash
# Launches the full local Obiren preview stack:
#   1. In-memory MongoDB + NestJS API on :3000
#   2. Next.js web app on :3001 (proxies /api/v1 -> :3000)
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"   # -> apps/api
REPO="$(cd "$ROOT/../.." && pwd)"            # -> repo root

: > /tmp/obiren-stack.log
echo "[stack] starting at $(date)" >> /tmp/obiren-stack.log
echo "[stack] repo: $REPO" >> /tmp/obiren-stack.log

# 1. API (compiled build + in-memory MongoDB)
cd "$ROOT"
node "$ROOT/scripts/start-api.mjs" >> /tmp/obiren-stack.log 2>&1 &
API_PID=$!
echo "[stack] api pid $API_PID" >> /tmp/obiren-stack.log

for i in $(seq 1 60); do
  if curl -sf -m 2 http://localhost:3000/api/v1/health >/dev/null 2>&1; then
    echo "[stack] api healthy after ${i}s" >> /tmp/obiren-stack.log
    break
  fi
  sleep 1
done

# 2. Web app
cd "$REPO/apps/web"
"$REPO/node_modules/.bin/next" dev -p 3001 >> /tmp/obiren-stack.log 2>&1 &
WEB_PID=$!
echo "[stack] web pid $WEB_PID" >> /tmp/obiren-stack.log

wait
