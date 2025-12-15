#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8787}"
HOST="${HOST:-0.0.0.0}"
RELOAD="${RELOAD:-0}"
USE_LLM="${USE_LLM:-0}"
LLM_PROVIDER="${LLM_PROVIDER:-gemini}"
REQUIRE_ENGINE="${REQUIRE_ENGINE:-0}"

ENGINE_BIN="/usr/local/bin/yaneuraou"
EVAL_DIR="/usr/local/bin/eval"
BOOK_DIR="/usr/local/bin/book"

engine_ok=1

if [[ -d "$ENGINE_BIN" ]]; then
  echo "WARNING: $ENGINE_BIN is a directory (host ./docker/engine/yaneuraou missing -> Docker created a dir). Put the real engine binary at docker/engine/yaneuraou and chmod +x." >&2
  engine_ok=0
elif [[ ! -e "$ENGINE_BIN" ]]; then
  echo "WARNING: Engine binary missing at $ENGINE_BIN (mount ./docker/engine/yaneuraou). FastAPI starts, but annotate may not work." >&2
  engine_ok=0
elif [[ ! -f "$ENGINE_BIN" ]]; then
  echo "WARNING: Engine path exists but is not a regular file: $ENGINE_BIN" >&2
  engine_ok=0
elif [[ ! -x "$ENGINE_BIN" ]]; then
  echo "WARNING: Engine binary not executable: $ENGINE_BIN (run: chmod +x docker/engine/yaneuraou)." >&2
  engine_ok=0
fi

if [[ "$REQUIRE_ENGINE" == "1" && "$engine_ok" != "1" ]]; then
  echo "ERROR: REQUIRE_ENGINE=1 but engine is not usable at $ENGINE_BIN" >&2
  exit 1
fi

if [[ "$engine_ok" == "1" ]] && grep -q "is a placeholder" "$ENGINE_BIN" 2>/dev/null; then
  echo "WARNING: $ENGINE_BIN looks like a placeholder. Replace docker/engine/yaneuraou with a real YaneuraOu binary for annotate." >&2
fi

if [[ ! -d "$EVAL_DIR" ]]; then
  echo "WARNING: Eval dir missing at $EVAL_DIR (mount ./docker/engine/eval)." >&2
fi

if [[ ! -d "$BOOK_DIR" ]]; then
  echo "INFO: Book dir not found at $BOOK_DIR (optional; mount ./docker/engine/book if you have it)." >&2
fi

if [[ "$USE_LLM" == "1" ]]; then
  provider="$(printf '%s' "$LLM_PROVIDER" | tr '[:upper:]' '[:lower:]')"
  case "$provider" in
    gemini)
      if [[ -z "${GEMINI_API_KEY:-}" ]]; then
        echo "ERROR: USE_LLM=1 and LLM_PROVIDER=gemini requires GEMINI_API_KEY" >&2
        exit 1
      fi
      ;;
    openai)
      if [[ -z "${OPENAI_API_KEY:-}" ]]; then
        echo "ERROR: USE_LLM=1 and LLM_PROVIDER=openai requires OPENAI_API_KEY" >&2
        exit 1
      fi
      ;;
    *)
      echo "ERROR: Unsupported LLM_PROVIDER='$LLM_PROVIDER' (expected gemini|openai)" >&2
      exit 1
      ;;
  esac
fi

uvicorn_args=("--app-dir" "backend" "--host" "$HOST" "--port" "$PORT")
if [[ "$RELOAD" == "1" ]]; then
  uvicorn_args+=("--reload")
fi

# Primary: api.main under backend/ (matches backend/api/main.py)
if python -c "import sys; sys.path.insert(0, '/app/backend'); import api.main" >/dev/null 2>&1; then
  exec uvicorn api.main:app "${uvicorn_args[@]}"
fi

echo "WARN: Failed to import api.main via --app-dir backend; falling back to backend.api.main" >&2

# Fallback: backend.api.main with PYTHONPATH=/app
fallback_args=("--host" "$HOST" "--port" "$PORT")
if [[ "$RELOAD" == "1" ]]; then
  fallback_args+=("--reload")
fi
exec uvicorn backend.api.main:app "${fallback_args[@]}"
