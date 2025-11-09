#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "=== E2E SMOKE START ==="

# load .env but do not overwrite existing env vars
if [ -f .env ]; then
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^\s*# ]] && continue
    key="${line%%=*}"
    if [ -z "${!key-}" ]; then
      export "$line"
    fi
  done < .env
fi

echo "1) Engine check"
EC_OUT=$(mktemp)
if ./scripts/engine_check.sh >"$EC_OUT" 2>&1; then
  echo "engine_check ran"
else
  echo "engine_check failed (first attempt)"
fi

if grep -q "usiok" "$EC_OUT" && grep -q "readyok" "$EC_OUT"; then
  echo "Engine handshake OK"
else
  echo "Engine handshake not OK: retrying with USI_OwnBook=false override"
  # set temporary override (do not write .env)
  export ENGINE_USI_OPTIONS=$(echo "${ENGINE_USI_OPTIONS:-}" | sed -E 's/USI_OwnBook=[^,]*/USI_OwnBook=false/' )
  ./scripts/engine_check.sh >"$EC_OUT" 2>&1 || true
  if grep -q "usiok" "$EC_OUT" && grep -q "readyok" "$EC_OUT"; then
    echo "Engine handshake OK after override"
  else
    echo "Engine handshake still failed. Dumping engine_check output:" >&2
    sed -n '1,200p' "$EC_OUT" >&2
    echo "Calling stop_all and exiting"
    ./scripts/stop_all.sh || true
    exit 1
  fi
fi

echo "2) Start backend"
./scripts/run_backend.sh > /tmp/backend.smoke.log 2>&1 &
BACK_PID=$!
echo "backend pid: $BACK_PID"

echo "Waiting for /health to return {\"status\":\"ok\"} (timeout 30s)"
for i in $(seq 1 30); do
  sleep 1
  if curl -sS http://localhost:8787/health 2>/dev/null | grep -q '"status":"ok"'; then
    echo "backend health OK"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "backend did not become healthy in time" >&2
    cat /tmp/backend.smoke.log >&2 || true
    ./scripts/stop_all.sh || true
    exit 1
  fi
done

echo "3) Analyze/Annotate call"
REQ='{"usi":"startpos moves 7g7f 3c3d","time":{"btime":0,"wtime":0,"byoyomi":2000},"multipv":3,"depth":0}'
RESP=$(curl -sS -X POST http://localhost:8787/annotate -H 'Content-Type: application/json' -d "$REQ") || true
echo "Annotate response size: ${#RESP}"
echo "$RESP" > /tmp/annotate.smoke.json

# check if any note has non-null pv or score_cp
HAS_VALID=$(echo "$RESP" | jq '[.notes[]? | select((.pv != null and .pv != "") or (.score_cp != null))] | length' 2>/dev/null || echo 0)
if [ "$HAS_VALID" -ge 1 ]; then
  echo "Annotate returned valid entries: $HAS_VALID"
else
  echo "Annotate did not return valid pv/score entries" >&2
  echo "Attempting backend stop and exit"
  ./scripts/stop_all.sh || true
  exit 1
fi

echo "4) Start web (attempt port 3000, fallback 3001)"
# remove lock if exists
rm -f apps/web/.next/dev/lock || true
PORT=3000
if lsof -t -i:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "port 3000 busy, switching to 3001"
  PORT=3001
fi

cd apps/web
if command -v pnpm >/dev/null 2>&1; then
  pnpm install
  pnpm dev --port "$PORT" > /tmp/web.smoke.log 2>&1 &
else
  npm i
  npm run dev -- --port "$PORT" > /tmp/web.smoke.log 2>&1 &
fi
WEB_PID=$!
echo "web pid: $WEB_PID"
cd - >/dev/null

echo "Waiting for /annotate (port $PORT) to return HTML >5KB (timeout 30s)"
for i in $(seq 1 30); do
  sleep 1
  HTTP_CODE=$(curl -sS -o /tmp/annotate_page.smoke.html -w "%{http_code}" http://localhost:$PORT/annotate || true)
  SIZE=$(wc -c < /tmp/annotate_page.smoke.html || echo 0)
  if [ "$HTTP_CODE" = "200" ] && [ "$SIZE" -gt 5120 ]; then
    echo "Web annotate OK (code $HTTP_CODE size $SIZE)"
    break
  fi
  if [ $i -eq 30 ]; then
    echo "Web annotate did not become available in time" >&2
    tail -n 200 /tmp/web.smoke.log >&2 || true
    ./scripts/stop_all.sh || true
    exit 1
  fi
done

echo "=== E2E SMOKE SUCCESS ==="
echo "Summary: backend healthy, annotate produced valid analysis, web annotate served HTML"

echo "Cleaning up (stop all)"
./scripts/stop_all.sh || true

echo "Logs: /tmp/backend.smoke.log /tmp/web.smoke.log /tmp/annotate.smoke.json"
echo "=== E2E SMOKE END ==="
