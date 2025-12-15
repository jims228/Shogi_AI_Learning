# Auth Plan（段階的に強化する方針）

このリポジトリは、まず「少人数テスターに安全に配れる」ことを優先し、認証を段階的に強化します。

## 現状（Phase 1）: 入口 Basic 認証 + API キー

### 入口（Reverse Proxy）
- 本番は Caddy を入口に置き、TLS (Let's Encrypt) を自動化
- `/health` は無認証（監視・死活確認のため）
- それ以外は Basic 認証を必須化（テスター配布用の“簡易ゲート”）

### アプリ（FastAPI）
- `API_KEYS`（CSV）を環境変数で渡し、`X-API-Key` ヘッダを検証
- 高負荷 API（例: `/annotate`, `/api/analysis/*`, `/api/tsume/play`, `/api/explain*`）には `Depends(require_api_key)` を付与
- `API_KEYS` 未設定時はローカル開発・テスト互換のため no-op（認証を要求しない）
- ただし `USE_LLM=1` の場合は安全のため `API_KEYS` を必須化（認証なしで外部 LLM を叩けない）

実装の入口:
- [backend/api/auth.py](../backend/api/auth.py)

## 将来（Phase 2）: ユーザー登録 + JWT（想定）

DB は未導入で OK（このドキュメントは設計方針のみ）。

### ゴール
- ユーザー登録/ログインにより JWT を発行
- FastAPI 側は `Authorization: Bearer <token>` を検証
- ルートは `Depends(get_principal)` の抽象で守り、トークン種別の差し替えを容易にする

### 設計方針（差し替え容易性）
- ルートは「誰か」を直接扱わず、**Principal** を受け取る
  - 例: `def endpoint(..., principal: Principal = Depends(get_principal)):`
- Phase 1 の `X-API-Key` でも、Phase 2 の JWT でも、最終的に `Principal` を返す
- `get_principal()`（または `require_principal()`）を単一の依存関数に集約し、
  - Phase 1: `X-API-Key` を検証
  - Phase 2: JWT を検証
  と差し替えるだけでルート側の変更量を最小化

### 失効/権限管理の想定
- Phase 1: `API_KEYS` から削除 = 失効
- Phase 2: 
  - JWT の短寿命化（例: 15分） + Refresh Token
  - 失効リスト（Redis 等）もしくは `token_version` を DB で管理

## 運用メモ

- テスター配布では **1人1キー** を推奨（漏えい時の影響範囲を限定）
- 漏えい/退会は **キー削除で失効**（Phase 1）
- 本番は入口（Caddy Basic）とアプリ（X-API-Key）の二段構えで最小限の防御を確保
