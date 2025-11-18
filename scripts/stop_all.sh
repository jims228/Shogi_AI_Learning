#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

echo "Stopping backend uvicorn processes (if any)"
pkill -f "uvicorn backend.api.main:app" 2>/dev/null || true

echo "Killing processes listening on port 3000"
lsof -t -i:3000 -sTCP:LISTEN | xargs -r kill -9 || true

echo "Removing apps/web/.next/dev/lock (if exists)"
rm -f apps/web/.next/dev/lock || true

echo "Stop complete"
