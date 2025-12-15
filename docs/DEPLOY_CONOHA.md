# ConoHa VPS (Ubuntu) デプロイ手順（コピペで進む）

目的:
- VPS 上で **80/443 のみ公開**
- Caddy で **TLS (Let's Encrypt) 自動取得**
- 入口は **Basic 認証**
- FastAPI 側は **/annotate 等に X-API-Key 必須** + **IP ベース簡易レート制限**

前提:
- ConoHa 側のセキュリティグループ（または同等のFW）で **22/80/443 だけ許可**、**8787 は閉じる**
- DNS の `A` レコードで `DOMAIN`（例: `shogi.example.com`）→ VPS のグローバル IP を向ける
- ここから先は **VPS に SSH ログイン済み**の想定

---

## 0) 変数（この手順で使う）

以降のコマンドで使うので、先に自分の値に置き換えてください。

- `DOMAIN`: 公開ドメイン
- `BASIC_AUTH_USER`: テスター向けの Basic 認証ユーザー名
- `API_KEY_1`: テスターに配る X-API-Key の例

---

## 1) UFW (22/80/443) を設定

```bash
sudo apt-get update
sudo apt-get install -y ufw

sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 念のため現在の設定確認
sudo ufw status verbose

# 有効化（SSH を切らないよう 22 を許可してから実行）
sudo ufw --force enable
sudo ufw status verbose
```

---

## 2) Docker / Compose をインストール

Ubuntu の標準パッケージで進めます（最小コピペ）。

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin

sudo systemctl enable --now docker
sudo docker version
sudo docker compose version
```

（任意）`sudo` なしで docker を叩きたい場合:

```bash
sudo usermod -aG docker "$USER"
# 反映には再ログインが必要
exit
```

再度 SSH で入り直したら続けてください。

---

## 3) リポジトリを取得

```bash
cd ~
git clone https://github.com/jims228/Shogi_AI_Learning.git
cd Shogi_AI_Learning
```

---

## 4) エンジン資産の配置（必須）

本番 compose は、ホスト側の以下をコンテナへ read-only マウントします。

- `docker/engine/yaneuraou` → コンテナ `/usr/local/bin/yaneuraou`
- `docker/engine/eval/` → コンテナ `/usr/local/bin/eval`
- `docker/engine/book/` → コンテナ `/usr/local/bin/book`（任意）

### 4-1) ディレクトリ作成

```bash
mkdir -p docker/engine/eval docker/engine/book
```

### 4-2) エンジンバイナリを配置

方法A: ローカルPCから VPS にアップロード（推奨）
- ローカルPC側で実行（例）:

```bash
# ローカルPCで実行。<VPS_IP> は置き換え。
scp /path/to/yaneuraou ubuntu@<VPS_IP>:~/Shogi_AI_Learning/docker/engine/yaneuraou
```

方法B: VPS に既にある場合は所定位置へコピー

```bash
# 例: 既存パスが /usr/local/bin/yaneuraou の場合
cp /usr/local/bin/yaneuraou docker/engine/yaneuraou
```

実行権限を付与:

```bash
chmod +x docker/engine/yaneuraou
```

### 4-3) eval 資産を配置

NNUE 等の評価ファイル（例: `nn.bin` / `*.nnue`）を `docker/engine/eval/` に置きます。

- ローカルPCからまとめて転送（例）:

```bash
# ローカルPCで実行
rsync -av /path/to/eval/ ubuntu@<VPS_IP>:~/Shogi_AI_Learning/docker/engine/eval/
```

book は任意（あるなら `docker/engine/book/` へ）

---

## 5) .env を作成

テンプレから作る:

```bash
cp .env.prod.example .env
```

`.env` を編集（必須項目を埋める）:

```bash
nano .env
```

最低限入れるもの:
- `DOMAIN`
- `BASIC_AUTH_USER`
- `BASIC_AUTH_HASH`
- `API_KEYS`

`BASIC_AUTH_HASH` は Caddy で生成できます（平文は置かない）:

```bash
# your-password を置き換え
sudo docker run --rm caddy:2 caddy hash-password --plaintext 'your-password'
```

出力された `$2a$...` を `.env` の `BASIC_AUTH_HASH=` に貼り付けます。

---

## 6) 起動（本番構成）

2つの compose を重ねて起動します。

```bash
cd ~/Shogi_AI_Learning

# 設定がマージできることを確認（環境変数が足りないとエラーになります）
docker compose -f docker-compose.yml -f docker-compose.prod.yml config

# 起動
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# 状態確認
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

---

## 7) 疎通確認（curl）

### 7-1) /health（認証なし）

VPS から:

```bash
curl -fsS http://127.0.0.1/health
```

外部（手元PC）から:

```bash
curl -fsS http://$DOMAIN/health
```

### 7-2) /docs（認証なしで 401）

HTTPS で確認（HTTP は HTTPS にリダイレクトします）:

```bash
curl -i https://$DOMAIN/docs | head
```

### 7-3) /annotate（Basic 認証 + X-API-Key 必須）

```bash
# your-password, X-API-Key を置き換え
curl -fsS -u "$BASIC_AUTH_USER:your-password" https://$DOMAIN/annotate \
  -H 'Content-Type: application/json' \
  -H 'X-API-Key: API_KEY_1' \
  -d '{"usi":"startpos moves 7g7f 3c3d 2g2f 8c8d"}'
```

期待:
- `X-API-Key` なし → 401
- 間違った `X-API-Key` → 401
- 連打して `RATE_LIMIT_PER_MINUTE` を超える → 429

---

## 8) ログ確認

```bash
cd ~/Shogi_AI_Learning

# Caddy（TLS取得/Basic認証）
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 -f caddy

# API（エンジン起動・/annotate）
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml logs --tail=200 -f api
```

---

## 9) 落ちた時の確認ポイント

### A) まずはコンテナ状態

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml ps
```

- `caddy` が `Restarting` / `Exited` の場合: `logs -f caddy`
- `api` が `Exited` の場合: `logs -f api`

### B) TLS が取れない / HTTPS が怪しい

- DNS の `A` レコードが VPS のIPか
- ConoHa 側セキュリティグループ + VPS 側 UFW で **80/443 が開いているか**
- `DOMAIN` が `.env` で正しいか
- `sudo docker compose ... logs -f caddy` に ACME/証明書エラーが出ていないか

### C) /docs が 401 にならない / 認証が効かない

- `BASIC_AUTH_USER` / `BASIC_AUTH_HASH` が `.env` に入っているか
- `BASIC_AUTH_HASH` は bcrypt hash（`caddy hash-password` の出力）か

### D) /annotate が失敗する

- 401 の場合:
  - `API_KEYS` が `.env` に入っているか（本番は必須）
  - `X-API-Key` を付けているか
- 500 の場合:
  - エンジン資産が揃っているか: `docker/engine/yaneuraou` が実体で `chmod +x` 済みか
  - `docker/engine/eval/` に `nn*.bin` / `*.nnue` があるか
  - `sudo docker compose ... logs -f api` にエンジン起動失敗や WARNING が出ていないか

### E) 429（レート制限）

- `RATE_LIMIT_PER_MINUTE` を増やす（`.env` を編集 → `docker compose ... up -d`）

---

## 停止/再起動

```bash
cd ~/Shogi_AI_Learning
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml down
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```
