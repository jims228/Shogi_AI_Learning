#!/usr/bin/env bash
set -eu

ROOT_DIR=$(cd "$(dirname "$0")/.." && pwd)
cd "$ROOT_DIR"

echo "Patching .env for engine usage..."
scripts/patch_env_for_engine.sh

echo "Bringing down any existing compose..."
docker compose down -v --remove-orphans || true

echo "Starting compose..."
docker compose up -d --build

echo "Waiting for API /health (max 60s)..."
SECS=0
until curl -fsS http://localhost:8787/health >/dev/null 2>&1; do
  sleep 1
  SECS=$((SECS+1))
  if [ $SECS -ge 60 ]; then
    echo "API /health did not become available within 60s"
    echo "Dumping api logs:"
    docker compose logs api || true
    exit 1
  fi
done
echo "API is healthy after ${SECS}s"

echo "Posting test annotate request..."
PAYLOAD='{"usi":"startpos moves 7g7f 3c3d", "time":{"btime":0,"wtime":0,"byoyomi":2000}, "multipv":3, "depth":6}'
RESPONSE=$(curl -s -X POST http://localhost:8787/annotate -H "Content-Type: application/json" -d "$PAYLOAD")
echo "Response:"
echo "$RESPONSE" | jq . || echo "$RESPONSE"

echo "Asserting presence of non-null notes[].pv and notes[].score_cp"
HAS_GOOD=$(echo "$RESPONSE" | jq '[.notes[] | select(.pv != null and .score_cp != null)] | length') || HAS_GOOD=0
if [ "$HAS_GOOD" -ge 1 ]; then
  echo "Success: found $HAS_GOOD notes with pv and score_cp"
  exit 0
else
  echo "Failure: no notes with non-null pv and score_cp"
  echo "Dumping api logs:"
  docker compose logs api || true
  exit 2
fi
