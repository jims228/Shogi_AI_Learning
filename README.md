# Shogi AI Learning Platform

A full-stack monorepo that combines a modern Next.js frontend, a FastAPI backend, and a USI-compatible shogi engine to deliver rich annotations, replay tooling, and learning workflows for serious players.

## Features
- **Annotate** – Stream multi-PV engine analysis, automatic scoring, and LLM-ready notes.
- **Replay & KifuPlayer** – Interactive timeline with move-by-move board rendering, orientation controls, and MultiPV overlays.
- **Review Tab** – Summaries, key-moment detection, and principle tagging powered by the backend reasoning stack.
- **Edit Mode** – Load KIF / CSA / USI text, tweak positions, and re-run evaluations.
- **Engine Integration** – YaneuraOu (NNUE) wrapped behind an analysis API with streaming SSE.
- **Learning Services** – Batch annotators, evaluator/generator modules, and future Duolingo-style drills.

## Tech Stack
- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS, Radix.
- **Backend**: FastAPI, Pydantic, httpx, engine orchestration utilities.
- **Engine Layer**: YaneuraOu + NNUE/book assets, Dockerized entrypoints, Python supervisors.
- **Tooling**: pnpm workspace, Jest, ESLint, Ruff/Black, mypy, pytest.

## Repository Layout
```
apps/
	web/        # Next.js UI
	backend/    # FastAPI service
engine/       # USI engine wrappers & supervisor scripts
packages/     # Shared TS/JS libraries (planned)
scripts/      # Startup helpers
tests/        # Cross-service tests
docs/         # Architecture & roadmap
infra/        # Dockerfiles, compose files, deployment manifests
```

## Getting Started

### Prerequisites
- Node.js 20+
- pnpm 9+
- Python 3.11+
- USI engine binaries (YaneuraOu) and NNUE/book files placed under `docker/engine/{eval,book}`.

### Install dependencies
```bash
pnpm install
cd apps/backend && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt
```

### Environment files
- Copy `.env.example` → `.env` and adjust engine paths.
- `apps/web/.env.local` and `apps/backend/.env` should define matching `ENGINE_URL` / `NEXT_PUBLIC_ENGINE_URL` values.

### Run locally
```bash
# Terminal 1 – Backend + engine proxy
./scripts/run_backend.sh      # starts FastAPI on :8787 and engine bridge

# Optional: load env file and/or enable LLM
# - Default: USE_LLM=0 (no external calls)
# - To enable: set USE_LLM=1 and provide provider key in the env file
# - Optional: use USE_LLM_REASONING / USE_LLM_REWRITE to avoid double LLM in one request
#
# Example:
#   ./scripts/run_backend.sh
#   ENV_FILE=.env.production USE_LLM=1 USE_LLM_REASONING=1 USE_LLM_REWRITE=0 ./scripts/run_backend.sh

# Terminal 2 – Web
pnpm --filter web dev         # or ./scripts/run_web.sh

# Optional combined script
./scripts/start-local.sh
```

Endpoints:
- Frontend: http://localhost:3000
- Backend API: http://localhost:8787
- Engine health: http://localhost:8001/health (standalone engine server)

## pnpm Workspace
- Defined in `pnpm-workspace.yaml` (see below).
- Install once at the repo root: `pnpm install`.
- Filtered commands:
	- `pnpm --filter web lint`
	- `pnpm --filter web typecheck`
	- `pnpm --filter web build`
	- `pnpm --filter backend test` (if backend adds JS tooling later)
- Add shared packages under `packages/*` and reference via `workspace:*`.

## Branching & Release Strategy
- `main` – stable, protected branch; release tags cut from here.
- `develop` – integration branch receiving reviewed feature branches.
- `feat/<slug>` – short-lived branches for features/bugfixes; merge into `develop` through PRs.
- `hotfix/<slug>` – branched from `main` for urgent fixes, merged back into both `main` and `develop`.

## Contribution Guide
1. Create/assign yourself an issue.
2. Branch off `develop`: `git checkout -b feat/<slug>`.
3. Keep commits focused; run `pnpm --filter web lint`, `pnpm --filter web typecheck`, backend linters (`black --check`, `ruff`, `mypy`), and tests before pushing.
4. Open a PR to `develop`, request review, ensure CI passes.
5. Maintainers handle `develop` → `main` promotion via release PRs.

## Roadmap
- **Engine API v2** – configurable time controls, multi-engine support, streaming diffs.
- **LLM Reasoning** – richer textual explanations, “teach me” drills, contextual references.
- **Curriculum Mode** – personalized study plans from annotated games and weaknesses.
- **Mobile-friendly UI** – optimize annotate/replay flows for touch devices.
- **Cloud Deployments** – Terraform/Bicep deployment templates for Azure/AWS.
- **Additional Engines** – integrate dlshogi, Suisho, or other NNUE-compatible engines.

## License & Credits
- Codebase: MIT (planned).
- YaneuraOu: follows upstream license.
- NNUE / book assets are proprietary; do not commit or redistribute them.