#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# default: LLM OFF
export USE_LLM="${USE_LLM:-0}"

# load env file if specified
ENV_FILE="${ENV_FILE:-.env.local}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
elif [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

# venv
if [ -f backend/api/.venv/bin/activate ]; then
  source backend/api/.venv/bin/activate
fi

export PYTHONPATH=.

# Safety: require explicit enable + key
if [[ "${USE_LLM:-0}" == "1" ]]; then
  : "${LLM_PROVIDER:=gemini}"
  if [[ "${LLM_PROVIDER}" == "gemini" && -z "${GEMINI_API_KEY:-}" ]]; then
    echo "ERROR: USE_LLM=1 but GEMINI_API_KEY is empty" >&2
    exit 1
  fi
  if [[ "${LLM_PROVIDER}" == "openai" && -z "${OPENAI_API_KEY:-}" ]]; then
    echo "ERROR: USE_LLM=1 but OPENAI_API_KEY is empty" >&2
    exit 1
  fi
fi

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8787}"
RELOAD="${RELOAD:-1}"

echo "== Backend starting on :${PORT} (USE_LLM=${USE_LLM}, LLM_PROVIDER=${LLM_PROVIDER:-unset}) =="

uvicorn_args=(backend.api.main:app --host "$HOST" --port "$PORT")
if [[ "$RELOAD" == "1" ]]; then
  uvicorn_args+=(--reload)
fi

exec uvicorn "${uvicorn_args[@]}"
