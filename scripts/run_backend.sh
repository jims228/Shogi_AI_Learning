#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# .env 読み込み
if [ -f .env ]; then
  set -a
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^\s*# ]] && continue
    export "$line"
  done < .env
  set +a
fi

# venv
if [ -f backend/api/.venv/bin/activate ]; then
  source backend/api/.venv/bin/activate
fi

export PYTHONPATH=.
echo "== Backend starting on :8787 =="
uvicorn backend.api.main:app --host 0.0.0.0 --port 8787 --reload
