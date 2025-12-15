#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

PYTHON_BIN=""
if command -v python >/dev/null 2>&1; then
  PYTHON_BIN="python"
elif command -v python3 >/dev/null 2>&1; then
  PYTHON_BIN="python3"
else
  echo "ERROR: python/python3 not found on host; cannot verify ELF binaries. Install python3 or place engine binary manually." >&2
  exit 1
fi

engine_dst="docker/engine/yaneuraou"
eval_dst_dir="docker/engine/eval"
book_dst_dir="docker/engine/book"

mkdir -p "$(dirname "$engine_dst")" "$eval_dst_dir" "$book_dst_dir"

python_elf_check() {
  # prints: ELF|NOT_ELF|MISSING
  local path="$1"
  "$PYTHON_BIN" - <<'PY' "$path"
import sys
p = sys.argv[1]
try:
    with open(p, 'rb') as f:
        head = f.read(4)
    if head == b'\x7fELF':
        print('ELF')
    else:
        print('NOT_ELF')
except FileNotFoundError:
    print('MISSING')
PY
}

find_engine_source() {
  local candidates=(
    "/usr/local/bin/yaneuraou"
    "$(command -v yaneuraou 2>/dev/null || true)"
    "$HOME/engines/yaneuraou/yaneuraou"
    "$HOME/engines/YaneuraOu/yaneuraou"
  )

  for c in "${candidates[@]}"; do
    [[ -n "$c" ]] || continue
    if [[ -f "$c" ]]; then
      echo "$c"
      return 0
    fi
  done

  return 1
}

copy_engine_binary() {
  local src
  if ! src="$(find_engine_source)"; then
    echo "ERROR: Could not find a yaneuraou binary on this host. Expected /usr/local/bin/yaneuraou or PATH." >&2
    return 1
  fi

  if [[ -d "$engine_dst" ]]; then
    echo "INFO: Removing directory $engine_dst (Docker bind-mount auto-created it)." >&2
    rm -rf "$engine_dst"
  fi

  local dst_state
  dst_state="$(python_elf_check "$engine_dst")"

  if [[ "$dst_state" == "ELF" ]]; then
    echo "INFO: $engine_dst already looks like an ELF binary; leaving it as-is." >&2
  else
    if [[ -e "$engine_dst" ]]; then
      echo "INFO: Removing non-ELF $engine_dst before replacing." >&2
      rm -f "$engine_dst"
    fi

    local src_state
    src_state="$(python_elf_check "$src")"
    if [[ "$src_state" != "ELF" ]]; then
      echo "ERROR: Host candidate is not an ELF binary: $src" >&2
      return 1
    fi

    echo "INFO: Copying engine binary: $src -> $engine_dst" >&2
    cp -L "$src" "$engine_dst"
    chmod +x "$engine_dst"
  fi

  echo "OK: engine binary ready at $engine_dst" >&2
}

copy_eval_assets_if_empty() {
  shopt -s nullglob
  local existing=("$eval_dst_dir"/*)
  shopt -u nullglob

  if (( ${#existing[@]} > 0 )); then
    echo "INFO: $eval_dst_dir is not empty; skipping eval copy." >&2
    return 0
  fi

  echo "WARNING: $eval_dst_dir is empty. Trying to locate NNUE/eval assets on host..." >&2

  local -a roots=("$HOME/engines" "/usr/local")
  local tmp
  tmp="$(mktemp)"
  trap 'rm -f "$tmp"' RETURN

  for r in "${roots[@]}"; do
    [[ -d "$r" ]] || continue
    find "$r" -maxdepth 5 -type f \( -iname 'nn*.bin' -o -iname '*.nnue' \) 2>/dev/null >>"$tmp" || true
  done

  if [[ ! -s "$tmp" ]]; then
    echo "WARNING: No NNUE/eval files found under ~/engines or /usr/local. Please copy your eval assets into $eval_dst_dir." >&2
    return 0
  fi

  # Pick the directory that contains the most matches.
  local best_dir
  best_dir="$(awk '{d=$0; sub(/\/[^\/]+$/, "", d); cnt[d]++} END{best=""; bestc=0; for (d in cnt) if (cnt[d]>bestc){best=d; bestc=cnt[d]} if (best!=""){print best}}' "$tmp")"

  if [[ -z "$best_dir" || ! -d "$best_dir" ]]; then
    echo "WARNING: Could not derive an eval directory. Please copy eval assets into $eval_dst_dir." >&2
    return 0
  fi

  echo "INFO: Copying eval assets from $best_dir -> $eval_dst_dir (no overwrite)" >&2

  if command -v rsync >/dev/null 2>&1; then
    rsync -a --ignore-existing "$best_dir"/ "$eval_dst_dir"/
  else
    echo "WARNING: rsync not found; falling back to cp -an" >&2
    cp -an "$best_dir"/. "$eval_dst_dir"/ || true
  fi

}

copy_engine_binary
copy_eval_assets_if_empty

echo "" >&2
echo "Next:" >&2
echo "  docker compose down --remove-orphans" >&2
echo "  docker compose up -d --build" >&2
echo "  curl -fsS http://localhost:8787/health" >&2
echo "  curl -fsS -X POST http://localhost:8787/annotate -H 'Content-Type: application/json' -d '{\"usi\":\"startpos moves 7g7f 3c3d 2g2f 8c8d\"}'" >&2
