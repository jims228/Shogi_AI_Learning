#!/usr/bin/env bash
set -eu

# Backup existing .env if present
ENV_FILE=.env
BACKUP_FILE=.env.bak
if [ -f "$ENV_FILE" ]; then
  cp "$ENV_FILE" "$BACKUP_FILE"
  echo "Backed up $ENV_FILE -> $BACKUP_FILE"
fi

# Desired values
declare -A KV
KV[USE_DUMMY_ENGINE]=0
KV[ENGINE_CMD]="/engines/bin/yaneuraou"
KV[ENGINE_EVAL_DIR]="/engines/eval"
KV[ENGINE_BOOK_DIR]="/engines/book"
KV[ENGINE_USI_OPTIONS]="Threads=8,USI_Hash=256,USI_OwnBook=false"

# Read existing file into associative array
declare -A EXIST
if [ -f "$ENV_FILE" ]; then
  while IFS= read -r line; do
    # skip comments and blank
    [[ -z "$line" || "$line" =~ ^\s*# ]] && continue
    key="${line%%=*}"
    val="${line#*=}"
    EXIST["$key"]="$val"
  done < "$ENV_FILE"
fi

# Overwrite/add keys
for k in "${!KV[@]}"; do
  EXIST["$k"]="${KV[$k]}"
done

# Write back
tmpfile=$(mktemp)
for k in "${!EXIST[@]}"; do
  echo "$k=${EXIST[$k]}" >> "$tmpfile"
done
mv "$tmpfile" "$ENV_FILE"
echo "Wrote $ENV_FILE with updated engine settings"
