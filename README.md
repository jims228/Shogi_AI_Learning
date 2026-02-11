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

### Environment files (single source of truth)
- Copy `.env.example` → **repo root** `.env` and adjust engine paths.
- Policy: **Only repo-root `.env` is used for Gemini keys/models.** Do not set `GEMINI_*` or `GOOGLE_API_KEY` in `.env.local` or `.envrc`.
- Legacy files like `apps/web/.env` or `backend/api/.env` are **not** read for Gemini. If they exist for other purposes, keep them for non-Gemini settings only, or rename to `.env.deprecated`.
- If you use `apps/web/.env.local`, keep it for web-only settings (e.g. `NEXT_PUBLIC_*`), and **do not** place Gemini keys there.
- Auth/Billing progress notes: `docs/auth-billing-STATUS.md`.

### Env audit (recommended before LLM runs)
Run the audit helper to see which env files exist and what the runtime will use:
```bash
python3 tools/env_audit.py
```
It prints repo root, detected `.env/.env.* /.envrc`, and the **effective** `GEMINI_API_KEY` prefix + `GEMINI_MODEL` after loading root `.env`.
If you use direnv, avoid `.envrc` exports for Gemini keys.

### Secret hygiene (required)
- Only put API keys in repo-root `.env`.
- Do **not** place keys in `apps/**/.env*` or `.envrc`.
- Run before commit:
```bash
python3 tools/scan_secrets.py
```
If you use pre-commit, install it and enable hooks:
```bash
pre-commit install
```
For history rewrites after accidental commits, see `docs/security.md`.

### Batch generation with cost guards (recommended)
Use cost guard flags to prevent runaway billing:
```bash
python3 tools/generate_wkbk_explanations_gemini.py \
  --provider openai \
  --only-lineage "詰将棋" \
  --max-items 50 \
  --max-requests 50 \
  --max-total-tokens 200000 \
  --max-estimated-cost-usd 1.00 \
  --max-rpm 30 \
  --sleep-secs 1
```
Notes:
- Set `OPENAI_API_KEY`/`OPENAI_MODEL` (or `GEMINI_*`) in repo root `.env`.
- For cost estimation, set `OPENAI_PRICE_INPUT_USD_PER_1K` / `OPENAI_PRICE_OUTPUT_USD_PER_1K`
  (and Gemini equivalents if using Gemini).

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

## Docker (backend only)

This repo includes a minimal backend-only `docker-compose.yml` so a server can boot FastAPI with one command.

### B: annotate まで動かす（エンジン/資産はマウントで提供）

`docker compose up -d --build` で FastAPI とエンジン連携（annotate）が動くように、ホスト側にエンジンと資産を配置してコンテナへマウントします。

配置するもの（ホスト側）:
- `docker/engine/yaneuraou` : YaneuraOu 実行ファイル（USI対応）。
- `docker/engine/eval/` : NNUE 等の eval 資産（例: `nn.bin`）。
- `docker/engine/book/` : 定跡/学習用データ（任意）。

補足:
- `docker-compose.yml` は上記をそれぞれ `/usr/local/bin/yaneuraou`・`/usr/local/bin/eval`・`/usr/local/bin/book` に read-only でマウントします。
- リポジトリには `docker/engine/yaneuraou.example` があり、実体のバイナリはコミットしない運用です。

実行権限（ホスト側）:

```bash
chmod +x docker/engine/yaneuraou
```

推奨（ホスト側セットアップ）:

```bash
chmod +x scripts/setup_engine_assets.sh
./scripts/setup_engine_assets.sh
```

起動:

```bash
docker compose up -d --build
```

確認:

```bash
docker compose logs -f api
curl -fsS http://localhost:8787/health
```

Swagger:
- http://localhost:8787/docs

annotate の確認:
- Swagger の `/annotate` (POST) を開き、`backend/api/test_annotate.py` と同じ例として `{"usi": "startpos moves 7g7f 3c3d 2g2f 8c8d"}` を送って `notes` が返ることを確認します。

curl での疎通例（テストと同じ JSON）:

```bash
curl -fsS -X POST http://localhost:8787/annotate \
	-H 'Content-Type: application/json' \
	-d '{"usi":"startpos moves 7g7f 3c3d 2g2f 8c8d"}'
```

## VPS (production)

目的: VPS 上で **80/443 のみ公開**し、TLS(Let's Encrypt) と Basic 認証を入口に付けたうえで、FastAPI 側でも高負荷 API を `X-API-Key` 必須にできます。

### 1) VPS 側の前提

- DNS: `A` レコードで `DOMAIN` (例: `shogi.example.com`) を VPS のグローバル IP に向ける
- ConoHa 等のセキュリティグループ/ファイアウォール: **22/80/443 のみ許可**、**8787 は閉じる**

### 2) .env を用意

本番では `docker compose -f docker-compose.yml -f docker-compose.prod.yml ...` を使います。

`.env` 例:

```bash
# Reverse proxy
DOMAIN=shogi.example.com

# Caddy Basic Auth
BASIC_AUTH_USER=tester
# 生成例: docker run --rm caddy:2 caddy hash-password --plaintext 'your-password'
BASIC_AUTH_HASH=$2a$14$XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# App-level API keys (CSV). 未設定だとローカル/dev互換で no-op。
API_KEYS=devkey1,devkey2

運用メモ（推奨）:
- `X-API-Key` は **1人1キー** で配布（漏えい時の影響範囲を最小化）
- 漏えい/退会/停止したいキーは **`API_KEYS` から削除**して失効（再起動/再デプロイで反映）
- 生成用の簡易スクリプト: `python3 scripts/gen_api_key.py`

# Safety defaults
USE_LLM=0

# /annotate rate limit (per IP, per minute)
RATE_LIMIT_PER_MINUTE=60
```

### 3) 起動

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

### 4) 起動後の確認

- health (認証なし):

```bash
curl -fsS http://$DOMAIN/health
```

- 認証なしで docs は 401（HTTPS で確認）:

```bash
curl -i https://$DOMAIN/docs | head
```

- Basic 認証ありでアクセスできる:

```bash
curl -u "$BASIC_AUTH_USER:your-password" -i https://$DOMAIN/docs | head
```

- `X-API-Key` なしで /annotate は 401/403（本番は `API_KEYS` を必ず設定）:

```bash
curl -u "$BASIC_AUTH_USER:your-password" -i https://$DOMAIN/annotate \
	-H 'Content-Type: application/json' \
	-d '{"usi":"startpos moves 7g7f 3c3d 2g2f 8c8d"}' | head
```

- `X-API-Key` ありで /annotate が通る:

```bash
curl -u "$BASIC_AUTH_USER:your-password" -fsS https://$DOMAIN/annotate \
	-H 'Content-Type: application/json' \
	-H 'X-API-Key: devkey1' \
	-d '{"usi":"startpos moves 7g7f 3c3d 2g2f 8c8d"}'
```

- レート制限超過で 429:
	- `RATE_LIMIT_PER_MINUTE` を小さくして短時間に連打すると `429 Rate limit exceeded` になります。

## pnpm Workspace
- Defined in `pnpm-workspace.yaml` (see below).
- Install once at the repo root: `pnpm install`.
- Filtered commands:
	- `pnpm --filter web lint`
	- `pnpm --filter web typecheck`
	- `pnpm --filter web build`
	- `pnpm --filter backend test` (if backend adds JS tooling later)
- Add shared packages under `packages/*` and reference via `workspace:*`.

## Mobile (Roadmap-only MVP)

`apps/mobile` is an Expo (TypeScript) app that renders the **roadmap natively** and launches lessons in a **WebView**.

- No AI/engine/analysis UI is included in the mobile app.
- Lesson completion is reported back to the app via `postMessage`, and progress is stored locally in `AsyncStorage`.

### Run locally

Start Web:

```bash
pnpm --filter web dev
```

Start Mobile:

```bash
pnpm -C apps/mobile start
```

### Android実機 (Windows + WSL2 + USB) で 127.0.0.1 を使う

実機アプリの設定を **`WEB_BASE_URL=http://127.0.0.1:3000` / `API_BASE_URL=http://127.0.0.1:8787`** のまま使うために、Windows → WSL2 の portproxy と `adb reverse` を毎回貼り直します。

毎回の起動手順（3ステップ）:
1) **WSLで3つ起動**（0.0.0.0 で listen 推奨）
```bash
HOST=0.0.0.0 PORT=8787 ./scripts/run_backend.sh
pnpm --filter web dev -- --hostname 0.0.0.0 --port 3000
pnpm -C apps/mobile start -- --lan --port 8081
```
2) **PowerShell 管理者でスクリプト実行**
```powershell
.\scripts\android-usb-wsl2.ps1
```
3) **実機で起動**（アプリ設定は `127.0.0.1` のままでOK）

### Real device / emulator URL notes (localhost problem)

Mobile opens lessons at:
- `/m/lesson/<lessonId>?mobile=1&noai=1&lid=<lessonId>`

So **the device must be able to reach your Web dev server**.

- Android Emulator:
  - WebBaseURL: `http://10.0.2.2:3000`
- iOS Simulator:
  - WebBaseURL: `http://localhost:3000` (usually works)
- Real device (iOS/Android):
  - Start web with LAN bind (example):

```bash
pnpm --filter web dev -- --hostname 0.0.0.0 --port 3000
```

  - WebBaseURL in the mobile app Settings:
    - `http://<YOUR_PC_LAN_IP>:3000` (same Wi‑Fi/LAN)

### Env vars (mobile)

- `EXPO_PUBLIC_WEB_BASE_URL` (default `http://localhost:3000`)
- `EXPO_PUBLIC_API_BASE_URL` (default `http://localhost:8787`, MVP unused; future sync)

### Update roadmap JSON (mobile + web/public)

`apps/web/src/constants.ts` is the source. Export to JSON:

```bash
node scripts/export_roadmap_json.js
```

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