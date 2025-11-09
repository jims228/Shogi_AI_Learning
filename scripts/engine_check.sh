#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# .env を読む
if [ -f .env ]; then
  set -a
  # シンプルに読み込む（#行と空行をスキップ）
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^\s*# ]] && continue
    export "$line"
  done < .env
  set +a
fi

: "${ENGINE_CMD:?ENGINE_CMD is not set in .env}"

echo "== USI handshake =="
"$ENGINE_CMD" <<EOF
usi
$( [[ -n "${ENGINE_EVAL_DIR:-}" ]] && echo "setoption name EvalDir value ${ENGINE_EVAL_DIR}" )
$( [[ "${ENGINE_USI_OPTIONS:-}" == *"USI_OwnBook=true"* ]] && echo "setoption name USI_OwnBook value true" || echo "setoption name USI_OwnBook value false" )
$( [[ "${ENGINE_USI_OPTIONS:-}" == *"BookFile="* ]] && echo "setoption name BookFile value $(echo "$ENGINE_USI_OPTIONS" | sed -n 's/.*BookFile=\([^,]*\).*/\1/p')" )
$( [[ -n "${ENGINE_BOOK_DIR:-}" ]] && echo "setoption name BookDir value ${ENGINE_BOOK_DIR}" )
isready
quit
EOF
