🏯 Shogi_AI_Learning

やねうら王エンジンを統合した将棋AI解析・学習システム

🚀 概要

本プロジェクトは、将棋エンジン YaneuraOu（やねうら王） を Docker 上で動作させ、
アプリケーション（例：Web API やフロントエンド）から USI プロトコル経由で解析・指導を行う仕組みを構築しています。

以下の特徴があります：

✅ YaneuraOu（NNUE対応）を Docker で自動ビルド

✅ Suisho5 の評価関数（nn.bin）および標準定跡ファイルに対応

✅ docker compose up -d ですぐに起動

✅ curl や API から bestmove を取得可能

✅ フロント/バックエンド連携のための API 構成を準備中

🧩 構成
Shogi_AI_Learning/
├─ docker-compose.yml
├─ docker/
│  └─ engine/
│     ├─ Dockerfile
│     ├─ eval/          # 評価関数ファイル(nn.bin)を置く
│     ├─ book/          # 定跡ファイル(standard_book.dbなど)を置く
│     └─ ...
├─ backend/             # APIサーバ等（任意）
├─ scripts/
│  └─ engine_smoke.sh   # 動作確認スクリプト
├─ .gitignore
└─ README.md

⚙️ セットアップ手順
1️⃣ 必要ファイルを配置

配布不可のため、各自で用意してください。

docker/engine/eval/nn.bin            ← Suisho5 などの NNUE 評価関数
docker/engine/book/standard_book.db  ← 定跡ファイル（optional）

2️⃣ Dockerイメージのビルドと起動
docker compose up -d --build

3️⃣ 動作確認
docker compose exec -T engine sh -lc '/usr/local/bin/yaneuraou <<EOF
usi
isready
quit
EOF'


正常に動作していれば以下のように表示されます：

usiok
info string loading eval file : /usr/local/bin/eval/nn.bin
info string read book file : /usr/local/bin/book/standard_book.db
readyok

🧠 思考テスト

1手だけ思考させる例：

docker compose exec -T engine sh -lc '/usr/local/bin/yaneuraou <<EOF
usi
setoption name USI_OwnBook value false
isready
position startpos
go byoyomi 1000
stop
quit
EOF'


出力例：

info depth 1 multipv 1 score cp 0 nodes 0 nps 0 hashfull 0 time 2 pv 1g1f
bestmove 1g1f

📦 .gitignore（抜粋）
docker/engine/eval/nn.bin
docker/engine/book/*.db
__pycache__/
*.pyc
node_modules/
.env
.vscode/
.DS_Store

🧭 今後の展望
フェーズ	内容
🔹 第1段階	エンジンAPI化（POST /analyze で解析結果JSON返却）
🔹 第2段階	LLM連携による「悪手理由」や「次の一手解説」の自動生成
🔹 第3段階	ユーザの棋譜学習・苦手パターン分析・定跡強化
🔹 第4段階	UI構築（Duolingo風・ShogiWars風インタフェース）
🔹 第5段階	オープンソース公開、他エンジン（dlshogi等）対応
⚖️ ライセンス・注意事項

本プロジェクトのコードは MIT License で公開予定です。

YaneuraOu 本体は YaneuraOu (GitHub)
 のライセンスに従います。

nn.bin（Suisho5 など）および定跡ファイルは再配布禁止です。
各自で適切に入手・設置してください。

🧑‍💻 作者

新後 亮人（Shingo Akito）
Aizu University — AI研究室
目的：将棋AIを用いた「わかりやすい棋譜解説AI」開発

## ローカル開発: シンプルな起動フロー

### 初回セットアップ

```bash
# 1. エンジンサーバーのPython環境をセットアップ
cd engine
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
deactivate

# 2. Node.js依存関係をインストール
cd ../
pnpm install
```

### 普段の起動手順

```bash
./scripts/start-local.sh
```

このスクリプトは以下を実行します：
- `engine/.venv`が存在することを確認
- エンジンサーバー(`engine_server.py`)をバックグラウンドで起動
- Next.js開発サーバー(`apps/web`)を起動(`pnpm dev`)

注意: `.venv`が存在しない場合はエラーメッセージが表示されます。

## ローカル開発: ワンコマンドでエンジン/API/Web を起動（VS Code）

以下のファイルを追加しました: `.env.example`, `scripts/*.sh`, `.vscode/tasks.json`, `.vscode/launch.json`

初期セットアップ手順:

```bash
cp .env.example .env
# .env 内の /home/USER を実ユーザー名に書き換えてください
chmod +x scripts/*.sh
```

エンジン接続の確認:

```bash
./scripts/engine_check.sh
# USI handshake が成功すると usiok / readyok 等が表示されます
```

個別起動（別ターミナル）:

```bash
./scripts/run_backend.sh    # API (http://localhost:8787)
./scripts/run_web.sh        # Web (http://localhost:3000)
```

VS Code から一括起動:

- Ctrl+Shift+P → Tasks: Run Task → All: start
- または Run and Debug → 起動構成 `ShogiAI (API+Web)` を実行

注意事項:

- `.env` やエンジンのバイナリ（`*.bin`, `*.nnue`）は Git に含めないでください（`.gitignore` を更新済み）。
- `ENGINE_CMD`, `ENGINE_EVAL_DIR`, `ENGINE_BOOK_DIR` は `.env` に絶対パスで設定してください。

### 定跡(book) を利用する

定跡ファイルを利用する場合は、以下の手順で配置・有効化してください。

1. 定跡ファイル（例: `book.bin` または `standard_book.db`）を配置:

```text
mkdir -p ~/engines/yaneuraou/book
# copy your book file
cp /path/to/book.bin ~/engines/yaneuraou/book/
```

2. `.env` の `ENGINE_USI_OPTIONS` を編集して定跡を有効化:

変更前（例）:
```text
ENGINE_USI_OPTIONS=Threads=8,USI_Hash=256,USI_OwnBook=false
```

変更後（例: book.bin を使用）:
```text
ENGINE_USI_OPTIONS=Threads=8,USI_Hash=256,USI_OwnBook=true,BookFile=book.bin,BookDir=/home/youruser/engines/yaneuraou/book,FlippedBook=true,BookDepthLimit=32
```

3. `.env` を保存してからエンジン確認:

```bash
./scripts/engine_check.sh
# 出力に 'read book file' と 'readyok' が表示されれば読み込み成功です
```

注意: `engine_check.sh` は book ファイルが存在しない場合、自動的に `USI_OwnBook=false` を利用して安全に接続します。`.env` を直接書き換える必要はありません。