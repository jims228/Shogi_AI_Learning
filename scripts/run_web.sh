#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../apps/web"

if command -v pnpm >/dev/null 2>&1; then
  pnpm install
  pnpm dev --port 3000
else
  npm i
  npm run dev -- --port 3000
fi
