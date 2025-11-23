#!/usr/bin/env bash
# Draft helper script to reorganize the repo into the aspirational structure.
# Review and edit before running. All mv commands are commented out to prevent
# accidental moves; uncomment intentionally once ready.

set -euo pipefail

REPO_ROOT=${1:-"$(cd "$(dirname "$0")/.." && pwd)"}
cd "$REPO_ROOT"

echo "Preparing directories..."
mkdir -p packages/shared-types docs infra

# Examples (uncomment as needed):
# mv backend apps/backend
# mv docker infra/docker
# mv README_DOCKER.md docs/engine.md
# mv README_KIFU.md docs/kifu.md
# touch packages/shared-types/package.json

cat <<'EOF'
Structure prepared. Review 'git status' and confirm moves before committing.
Consider running pnpm install after adjusting workspace packages.
EOF
