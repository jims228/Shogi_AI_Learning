#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

mkdir -p "$PROJECT_ROOT/logs"

# Configurable engine host/port via env, defaults
ENGINE_HOST_DEFAULT="127.0.0.1"
ENGINE_PORT_DEFAULT="8001"
ENGINE_HOST="${ENGINE_HOST:-$ENGINE_HOST_DEFAULT}"
ENGINE_PORT="${ENGINE_PORT:-$ENGINE_PORT_DEFAULT}"

echo "===> Checking engine/.venv"
if [ ! -d "$PROJECT_ROOT/engine/.venv" ]; then
  echo "ERROR: engine/.venv does not exist."
  echo "Please run the initial setup first:"
  echo "  cd engine && python3 -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

echo "===> Starting engine server (background)"
cd "$PROJECT_ROOT/engine"
# shellcheck disable=SC1091
source .venv/bin/activate
ENGINE_HOST="$ENGINE_HOST" ENGINE_PORT="$ENGINE_PORT" python engine_server.py > "$PROJECT_ROOT/logs/engine.log" 2>&1 &
ENGINE_PID=$!
deactivate
sleep 0.5

# Basic health wait loop (up to ~10 seconds)
echo "===> Waiting for engine health on http://$ENGINE_HOST:$ENGINE_PORT/health"
TRIES=0
until curl -fsS "http://$ENGINE_HOST:$ENGINE_PORT/health" | grep -q '"ok"' ; do
  if ! kill -0 $ENGINE_PID 2>/dev/null; then
    echo "ERROR: Engine process exited unexpectedly. See logs/engine.log"
    exit 1
  fi
  TRIES=$((TRIES+1))
  if [ $TRIES -ge 20 ]; then
    echo "ERROR: Engine did not become healthy in time. See logs/engine.log"
    exit 1
  fi
  sleep 0.5
done

echo "Engine running on http://$ENGINE_HOST:$ENGINE_PORT (PID: ${ENGINE_PID})"

echo "===> Starting web (pnpm dev)"
cd "$PROJECT_ROOT/apps/web"
pnpm dev
