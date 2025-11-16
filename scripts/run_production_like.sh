#!/usr/bin/env bash
# DEPRECATED: このスクリプトは使用しません。代わりに scripts/start-local.sh を使用してください。
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "===> loading env"
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

echo "===> prepare logs dir"
mkdir -p "$PROJECT_ROOT/logs"

echo "===> install deps (if needed)"
pnpm install

####################################
# エンジンサーバ（Python）の起動部分
####################################
echo "===> start USI engine server (Python)"
cd "$PROJECT_ROOT/engine"

# Python 仮想環境の準備
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
fi

# 仮想環境を有効化
# shellcheck disable=SC1091
source .venv/bin/activate

# Python 依存のインストール
pip install -r requirements.txt

# エンジンサーバをバックグラウンド起動
python engine_server.py > "$PROJECT_ROOT/logs/engine.log" 2>&1 &
ENGINE_PID=$!
echo "engine pid=${ENGINE_PID}"

# 仮想環境を抜ける
deactivate

cd "$PROJECT_ROOT"

####################################
# API サーバ（無ければスキップ）
####################################
echo "===> start API server (if exists)"
if [ -d "$PROJECT_ROOT/apps/api" ]; then
  cd "$PROJECT_ROOT/apps/api"
  pnpm build
  pnpm start:prod > "$PROJECT_ROOT/logs/api.log" 2>&1 &
  API_PID=$!
  echo "api pid=${API_PID}"
  cd "$PROJECT_ROOT"
else
  echo "apps/api ディレクトリが無いので API はスキップします"
fi

####################################
# Web(Frontend) 起動
####################################
echo "===> start Web(frontend)"
if [ -d "$PROJECT_ROOT/apps/web" ]; then
  cd "$PROJECT_ROOT/apps/web"
  pnpm build
  pnpm start > "$PROJECT_ROOT/logs/web.log" 2>&1 &
  WEB_PID=$!
  echo "web pid=${WEB_PID}"
  cd "$PROJECT_ROOT"
else
  # ルートが Next.js プロジェクトのパターン
  if [ -f "$PROJECT_ROOT/next.config.mjs" ] || [ -f "$PROJECT_ROOT/next.config.js" ]; then
    cd "$PROJECT_ROOT"
    pnpm build
    pnpm start > "$PROJECT_ROOT/logs/web.log" 2>&1 &
    WEB_PID=$!
    echo "web pid=${WEB_PID} (root)"
  else
    echo "Webフロントのディレクトリが特定できなかったのでスキップします"
  fi
fi

echo
echo "All services started (可能なものだけ起動しました)。"
echo "  engine pid: ${ENGINE_PID}"
[ -n "${API_PID:-}" ] && echo "  api    pid: ${API_PID}"
[ -n "${WEB_PID:-}" ] && echo "  web    pid: ${WEB_PID}"
echo "ログ: $PROJECT_ROOT/logs/*.log を確認してください。"
