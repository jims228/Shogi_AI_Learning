# AI解説機能：現状把握メモ（経路図）

## フロント → バックの経路（呼び出し/表示）

### 呼び出し元（UI）
- `apps/web/src/components/annotate/AnalysisTab.tsx`
  - **入力**: 盤面（`boardToSfen`）から `position ...` を組み立て、エンジン解析結果（bestmove / multipv）と一緒に送る
  - **送信先**: `POST ${API_BASE}/api/explain`
  - **受信/表示**:
    - 従来: `data.explanation`（文字列）をそのまま表示
    - 改善後: `data.explanation_json` があれば構造化表示（headline/why/pvGuide/risk）

### フロントが送っている主な情報
- **position**: `sfen`（USI `position ...` 形式）
- **手番**: `turn`（"b"/"w" 相当）
- **候補手/最善手**:
  - `bestmove`（エンジンbestmove）
  - `pv`（multipv[0].pv を文字列で）
  - `candidates[]`（最大3本、move/pv/score）
- **評価値**:
  - `score_cp` or `score_mate`
  - `delta_cp`（その手でどれだけ評価が動いたか）
- **履歴**: `history`（直近の指し手）

---

## バック：エンドポイント → 主要モジュール

### ルーティング
- `backend/api/main.py`
  - `POST /api/explain`
    - `ExplainRequest`（入力モデル）
    - `AIService.generate_shogi_explanation_payload()` を呼ぶ

### サービス層（解説生成）
- `backend/api/services/ai_service.py`
  - `generate_shogi_explanation_payload(data)`
    - **キャッシュ**（同局面連打で課金/遅延を抑止）
    - v2/legacy切替: `USE_EXPLAIN_V2`
    - **構造化JSON**（`explanation_json`）を常に生成し、スキーマ検証・整合性チェック
    - 失敗時は安全なフォールバック（rule-based / legacy）

### 事実抽出（局面/PV/評価値の正規化）
- `backend/api/utils/shogi_explain_core.py`
  - `build_explain_facts(req)`
    - `position` から盤面復元（`parse_position_cmd`）
    - `turn` 視点に評価値を正規化（cp/mate）
    - `pv_moves` / `pv_jp` 生成
    - `flags`（王手/駒取り/成り/打/大駒ライン等）抽出

### 文章生成（LLMなしで成立）
- `backend/api/utils/shogi_explain_core.py`
  - `render_rule_based_explanation(facts)`（従来テキストの安定フォールバック）

### 構造化出力（今回追加）
- `backend/api/utils/ai_explain_json.py`
  - `ExplainJson`（スキーマ）
  - `build_explain_json_from_facts(facts)`（決定論で生成）
  - `validate_explain_json(obj, facts)`（PV/詰み等の整合性チェック）

---

## どこで何を扱うか（局面/SFEN/手番/候補手/評価値/PV/持ち駒）
- **局面（SFEN/USI）**:
  - フロント: `boardToSfen` で `position ...` を組み立て
  - バック: `parse_position_cmd` で盤面復元（SFEN board部＋moves適用）
- **手番（turn）**:
  - フロント: `sideToMove` を送る
  - バック: `facts["turn"]` として扱い、評価値の符号/意味を揃える
- **候補手 / PV**:
  - フロント: engine multipv の `pv`（文字列）や先頭手を送る
  - バック: `pv_moves` を生成し、`pvGuide` と整合性チェック
- **評価値（cp/mate）**:
  - フロント: `score_cp` or `score_mate`
  - バック: `turn` 視点へ正規化し、"詰み" 表現の抑制/許可に使う
- **持ち駒**:
  - フロント: `boardToSfen` に含まれる（hand部）
  - バック: `position` をパースして盤面適用（詳細の合法性チェックは最小）

---

## 改善の狙い（最小差分）
- LLMに自由文を丸投げせず、**facts(JSON)を骨格**にする
- UIがブレないように **JSONスキーマ固定**（headline/why/pvGuide/risks）
- PV/詰み表現などの **機械検証** を通らない出力は **フォールバック**（嘘っぽい断定を抑止）


