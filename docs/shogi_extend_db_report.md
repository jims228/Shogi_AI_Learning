# shogi-extend DB 検証レポート

作成日: 2026-02-26
調査者: Claude (自動生成)

---

## 1. 概要

リポジトリ内に "shogi-extend" 由来のデータセットが以下の形式で存在する。
専用の外部 DB ファイルではなく、**JSONL + SQLite キャッシュ** の構成。

---

## 2. ファイル一覧

| パス | 形式 | サイズ | 説明 |
|------|------|--------|------|
| `tools/datasets/wkbk/wkbk_articles.jsonl` | JSONL (UTF-8) | 511 行 / ~1.3 MB | 元データ（問題記事） |
| `tools/datasets/wkbk/wkbk_explanations.sqlite` | SQLite 3.37 | 20 KB | LLM解説キャッシュ DB |
| `tools/datasets/wkbk/wkbk_explanations.jsonl` | JSONL (UTF-8) | 1 行 | SQLite OK件のみ再出力 |
| `tools/generate_wkbk_explanations_gemini.py` | Python スクリプト | 818 行 | JSONL → SQLite → JSONL 生成ツール |

---

## 3. スキーマ

### 3-A. `wkbk_articles.jsonl` — 元問題データ

各行は以下のフィールドを持つ JSON オブジェクト:

| フィールド | 型 | 説明 |
|-----------|----|----|
| `key` | string | MD5 ハッシュ (32文字) — ユニーク識別子 |
| `title` | string | 問題タイトル（日本語） |
| `description` | string | 問題説明（空のケースあり） |
| `hint_desc` | string | ヒント（空のケースあり） |
| `lineage_key` | string | カテゴリ（手筋/詰将棋/etc.） |
| `tag_list` | string[] | タグ配列（空のケース多い） |
| `init_sfen` | string | **局面キー: 初期局面 SFEN (prefix `position sfen ...`)** |
| `moves_answers` | {moves_str, moves_human_str}[] | 正解手順（USI形式） |
| `difficulty` | int | 難易度 (1〜5) |
| `time_limit_sec` | int | 制限時間（秒） |
| `source.author` | string | 著者（空のケースあり） |
| `source.about_key` | string | `"ascertained"` (検証済) など |
| `user.id` | int | 投稿ユーザー ID |
| `user.name` | string | 投稿ユーザー名 |
| `created_at` | ISO 8601 | 作成日時 |
| `updated_at` | ISO 8601 | 更新日時 |

**全 511 件が `init_sfen` を持つ。** SFEN が主要ルックアップキー。

### 3-B. `wkbk_explanations.sqlite` — LLM解説キャッシュ

```sql
CREATE TABLE explanations (
    key               TEXT PRIMARY KEY,      -- wkbk_articles の key に対応
    status            TEXT NOT NULL,         -- 'ok' | 'error'
    explanation_json  TEXT,                  -- WkbkExplanation JSON (when ok)
    error_type        TEXT,                  -- (when error)
    error_message     TEXT,                  -- (when error)
    raw_text          TEXT,                  -- raw model output (when error)
    created_at        TEXT NOT NULL,         -- ISO 8601 UTC
    updated_at        TEXT NOT NULL          -- ISO 8601 UTC
);
CREATE INDEX idx_explanations_status ON explanations(status);
CREATE INDEX idx_explanations_updated ON explanations(updated_at);
```

*注: `provider`, `model`, `prompt_tokens` 等の列は generate スクリプトが `ALTER TABLE` で追加する設計だが、現状の DB には存在しない（空状態のため未適用）。*

### 3-C. `explanation_json` 内のフィールド（`WkbkExplanation`）

| フィールド | 型 | 説明 |
|-----------|----|----|
| `key` | string | articles の key |
| `title` | string | 問題タイトル |
| `lineage_key` | string | カテゴリ |
| `tags` | string[] | タグ |
| `difficulty` | int | 難易度 |
| `goal` | string | 問題の狙い（1文） |
| `summary` | string | 全体解説（初心者向け） |
| `sequence` | {move_usi, why}[] | 手順解説（1手ずつ） |
| `common_mistakes` | string[] | ありがちな失敗 |
| `next_hint` | string | 次の練習ポイント |

---

## 4. 行数（テーブルごと）

| ソース | 行数 |
|--------|------|
| `wkbk_articles.jsonl` | 511 |
| `wkbk_explanations.sqlite` (total) | 1 |
| `wkbk_explanations.sqlite` (status=ok) | 1 |
| `wkbk_explanations.sqlite` (status=error) | 0 |
| `wkbk_explanations.jsonl` | 1 |

→ **LLM 解説はほぼ未生成（511件中1件のみ）。**

---

## 5. 局面キーの有無

- **あり**: `init_sfen` フィールドが全件存在
- 形式: `"position sfen <SFEN> <手番> <持駒> <手数>"`
- ルックアップ時は先頭の `"position sfen "` プレフィックスを除去し、SFEN 文字列を正規化して照合する
- 手数（末尾の数字）を除去して正規化。プレフィックスあり/なしどちらでも一致

### SFEN 正規化方針（実装済み）

```
normalize_sfen("position sfen lnsgkgsnl/... b - 1")
  → "lnsgkgsnl/... b -"   # プレフィックス除去、手数除去
```

---

## 5-b. ルックアップ精度（機械的全件検証 — 2026-02-26）

**全 511 件の `init_sfen` に対して `lookup_by_sfen()` を実行した結果:**

| 指標 | 値 |
|------|-----|
| 総件数 | 511 |
| ヒット | 511 (100.0%) |
| ミス | 0 |
| 検証日 | 2026-02-26 |

→ **100% ヒット確認済み。** ミス件数ゼロ。

---

## 6. 文字コード・欠損・重複

| 項目 | 結果 |
|------|------|
| 文字コード | UTF-8（BOMなし）|
| key の重複 | なし（MD5ハッシュ） |
| init_sfen の欠損 | 0件（全511件あり） |
| moves_answers の欠損 | まれに空配列あり |
| description 欠損（空文字） | 多数（説明なし問題が多い） |
| user.name | 16名（きなこもち含む） |

---

## 6-b. 投稿者別件数（2026-02-26 集計）

| 投稿者 | 件数 |
|--------|------|
| きなこもち | **314** (61.4%) |
| さくら | 80 |
| 名無しの棋士194号 | 42 |
| あ | 24 |
| shimopp | 21 |
| Pon | 7 |
| Wndr | 6 |
| 恵比歯科 | 6 |
| 柳沼秀一 | 3 |
| Koji Hirono | 2 |
| その他 (6名) | 6 |
| **合計** | **511** |

> きなこもちさんが過半数（314件）を投稿。データ提供に感謝。
> ライセンスが不明のため原文丸写しは禁止（タグ/カテゴリのみ使用）。

---

## 7. lineage_key 別内訳

| lineage_key | 件数 |
|-------------|------|
| 手筋 | 198 |
| 詰将棋 | 169 |
| 実戦詰め筋 | 56 |
| 定跡 | 46 |
| 必死 | 23 |
| 持駒限定詰将棋 | 13 |
| 必死逃れ | 6 |
| **合計** | **511** |

---

## 8. ライセンス・出典

| 項目 | 状態 |
|------|------|
| バンドル LICENSE ファイル | **なし** |
| バンドル README（ライセンス記載） | **なし** |
| データ出典 | shogi-extend (https://shogi-extend.com) — ユーザー投稿コンテンツ |
| `source.about_key` | `"ascertained"` (検証済) |
| ライセンス判定 | **不明（要確認）** |

**⚠️ 注意**: ライセンスが不明のため、以下の制約を厳守する:
1. 元データの `title`, `description`, `hint_desc` を**丸写し出力しない**
2. 出力は「タグ/カテゴリ/SFEN に基づくヒット有無 + 短い言い換えメモ」に限定
3. `sequence[].why` や `summary` は LLM 生成済みの場合のみ要約して参照可

---

## 9. 結論：使える / 使えない / 要整形

| 対象 | 判定 | 理由 |
|------|------|------|
| `wkbk_articles.jsonl` | ✅ **使える** | SFEN 完備, 511件, key ユニーク |
| `wkbk_explanations.sqlite` | ⚠️ **要生成** | 1件しか解説なし。generate スクリプトで追加生成すれば利用可 |
| `wkbk_explanations.jsonl` | ⚠️ **要生成** | 上記の出力版 |
| ライセンス | ⚠️ **要確認** | 不明のため著作権リスク管理必須 |

---

## 10. 解説パイプラインへの組み込み方針

### Phase 1（MVP）: articles のみ使用

- `wkbk_articles.jsonl` を起動時にメモリ上 `Map<normalizedSfen, Article>` に展開
- `/api/explain` 呼び出し時に SFEN で完全一致/正規化一致検索
- ヒット時は `{ hit: true, lineage_key, tags, title_hint }` を IR に追加（`title` 丸写し禁止）
- Gemini プロンプトに「この局面は `{lineage_key}` タイプです」として与える
- 未ヒット時は `{ hit: false }` を返す（落ちない設計）

### Phase 2（オプション）: explanations も使用

- LLM 生成済みの `explanation_json.goal` / `sequence[].why` を要約して IR に追加
- 解説の質向上が期待できる

### 参照 API（`lookupBySfen`）

```python
def lookup_by_sfen(sfen: str) -> dict:
    """
    Returns: {
        "hit": bool,
        "key": str | None,
        "lineage_key": str | None,
        "tags": list[str],
        "difficulty": int | None,
        "title_category_hint": str | None,  # lineage_key の言い換え（丸写し禁止）
    }
    """
```

---

*このレポートは自動生成です。ライセンス確認後に更新してください。*
