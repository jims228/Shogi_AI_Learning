#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."

# .env を読む (既にエクスポート済みの変数は上書きしない)
if [ -f .env ]; then
  # only export variables from .env if they are not already set in environment
  while IFS= read -r line; do
    [[ -z "$line" || "$line" =~ ^\s*# ]] && continue
    key="${line%%=*}"
    # if not already set in environment, export it
    if [ -z "${!key-}" ]; then
      export "$line"
    fi
  done < .env
fi

: "${ENGINE_CMD:?ENGINE_CMD is not set in .env}"

echo "== USI handshake =="

# Determine book availability without modifying .env
BOOKFILE=""
if echo "${ENGINE_USI_OPTIONS:-}" | grep -q "BookFile="; then
  BOOKFILE=$(echo "${ENGINE_USI_OPTIONS}" | sed -n 's/.*BookFile=\([^,]*\).*/\1/p')
fi

# If BookFile is present and relative, look under ENGINE_BOOK_DIR
BOOKPATH=""
if [ -n "$BOOKFILE" ]; then
  if [ -f "$BOOKFILE" ]; then
    BOOKPATH="$BOOKFILE"
  elif [ -n "${ENGINE_BOOK_DIR:-}" ] && [ -f "${ENGINE_BOOK_DIR%/}/$BOOKFILE" ]; then
    BOOKPATH="${ENGINE_BOOK_DIR%/}/$BOOKFILE"
  fi
fi

"$ENGINE_CMD" <<EOF
usi
$( [[ -n "${ENGINE_EVAL_DIR:-}" ]] && echo "setoption name EvalDir value ${ENGINE_EVAL_DIR}" )
$( if echo "${ENGINE_USI_OPTIONS:-}" | grep -q "USI_OwnBook=true" && [ -n "$BOOKPATH" ]; then echo "setoption name USI_OwnBook value true"; else echo "setoption name USI_OwnBook value false"; fi )
$( [ -n "$BOOKPATH" ] && echo "setoption name BookFile value $BOOKPATH" )
$( [[ -n "${ENGINE_BOOK_DIR:-}" ]] && echo "setoption name BookDir value ${ENGINE_BOOK_DIR}" )
isready
quit
EOF
