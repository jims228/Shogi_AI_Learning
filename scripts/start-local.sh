#!/usr/bin/env bash
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

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
python engine_server.py > "$PROJECT_ROOT/logs/engine.log" 2>&1 &
ENGINE_PID=$!
deactivate
echo "Engine started with PID: ${ENGINE_PID}"

echo "===> Starting web (pnpm dev)"
cd "$PROJECT_ROOT/apps/web"
pnpm dev
