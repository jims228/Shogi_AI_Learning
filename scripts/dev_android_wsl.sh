#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

kill_port() {
  local port="$1"
  local pids
  pids="$(ss -lntpH 2>/dev/null | sed -n "s/.*:${port} .*pid=\\([0-9]\\+\\).*/\\1/p" | sort -u || true)"
  if [[ -z "${pids}" ]]; then
    return 0
  fi
  echo "[dev:android] Port ${port} is in use by pid(s): ${pids}. Stopping..."
  # Try graceful first
  for pid in ${pids}; do
    kill "${pid}" 2>/dev/null || true
  done
  sleep 0.4
  # Force kill if still listening
  local still
  still="$(ss -lntpH 2>/dev/null | sed -n "s/.*:${port} .*pid=\\([0-9]\\+\\).*/\\1/p" | sort -u || true)"
  if [[ -n "${still}" ]]; then
    echo "[dev:android] Port ${port} still in use. Forcing kill: ${still}"
    for pid in ${still}; do
      kill -9 "${pid}" 2>/dev/null || true
    done
  fi
}

# Ensure fixed ports are available (avoids Expo prompt to switch ports)
kill_port 3000
kill_port 8081

echo "[dev:android] Starting web (3000) + expo metro (8081)..."
pnpm exec concurrently --restart-tries 3 --restart-after 1000 \
  -n web,expo -c cyan,magenta \
  "pnpm --filter web dev" \
  "pnpm -C apps/mobile start -- --localhost --port 8081 --clear"


