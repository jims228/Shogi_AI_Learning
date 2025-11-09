#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/web"

# remove dev lock if present
if [ -f .next/dev/lock ]; then
  echo "Removing .next/dev/lock"
  rm -f .next/dev/lock
fi

# choose port: prefer 3000, fallback to 3001 if in use
PORT=3000
if lsof -t -i:3000 -sTCP:LISTEN >/dev/null 2>&1; then
  echo "Port 3000 is in use; switching to 3001"
  PORT=3001
fi

if command -v pnpm >/dev/null 2>&1; then
  pnpm install
  echo "Starting web (pnpm) on port $PORT"
  pnpm dev --port "$PORT"
else
  npm i
  echo "Starting web (npm) on port $PORT"
  npm run dev -- --port "$PORT"
fi
