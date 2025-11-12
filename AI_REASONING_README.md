# 将棋AI注釈システム - AI層（根拠の言語化）

## 概要

将棋AI注釈アプリに「AI層（根拠の言語化）」機能を追加しました。この機能は、やねうら王などの将棋エンジン出力を解析し、各手に対して自然な日本語で「なぜその手が良い／悪いか」を説明します。

## 特徴

- **ハイブリッド設計**: ルールベース + LLM（Gemini/ChatGPT）の組み合わせ
- **学習不要**: 既存の学習済みAI（LLM）を活用
- **フォールバック**: LLMが無効でもルールベースのみで動作
- **Docker対応**: 環境変数による設定切り替え

## アーキテクチャ

```
backend/ai/
├── __init__.py              # モジュール初期化
├── reasoning.py             # 統合モジュール（build_reasoning）
├── reasoning_features.py    # 特徴抽出（Δcp、王手、駒取りなど）
├── reasoning_templates.py   # ルールベーステンプレート
└── reasoning_llm.py         # LLM統合（Gemini/OpenAI）
```

## API仕様

### 拡張されたレスポンス

`/annotate` エンドポイントの各 `MoveNote` に `reasoning` フィールドが追加されます：

```json
{
  "move": "7g7f",
  "reasoning": {
    "summary": "先手が歩を突いて角道を開ける自然な手。攻めの構想を広げている。",
    "tags": ["筋を開ける", "序盤"],
    "confidence": 0.85,
    "method": "llm_enhanced"
  }
}
```

## 環境設定

### 環境変数

```bash
# AI推論機能の有効化
USE_LLM=1                    # 0=ルールベースのみ, 1=LLM併用

# LLMプロバイダーの選択
LLM_PROVIDER=gemini          # gemini または openai

# APIキー（どちらか一つを設定）
GEMINI_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here
```

### 設定例

#### ルールベースのみ
```bash
USE_LLM=0
```

#### Gemini使用
```bash
USE_LLM=1
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key
```

#### OpenAI ChatGPT使用
```bash
USE_LLM=1
LLM_PROVIDER=openai
OPENAI_API_KEY=your_openai_api_key
```

## 機能詳細

### 1. 特徴抽出（reasoning_features.py）

エンジン出力から以下の特徴を抽出：

- **評価値**: Δcp（評価値変化）
- **戦術特徴**: 王手、駒取り、成り、打ち駒
- **戦略特徴**: 攻め、守り、駒組み、中央制圧
- **局面フェーズ**: 序盤、中盤、終盤

### 2. ルールベーステンプレート（reasoning_templates.py）

特徴に基づく日本語説明文の生成：

```python
# 例：好手のテンプレート
"良い手で、わずかに局面を改善しています。"
"適切な判断による良手です。"
```

### 3. LLM統合（reasoning_llm.py）

- **Gemini API**: Google の生成AI
- **OpenAI API**: ChatGPT（gpt-4o-mini）
- **自動フォールバック**: API障害時はルールベースを使用

### 4. 統合処理（reasoning.py）

```python
from backend.ai.reasoning import build_reasoning

# 単一手の推論生成
reasoning = build_reasoning(move_note, context)

# 複数手の一括処理
reasonings = build_multiple_reasoning(move_notes, global_context)
```

## 使用例

### ルールベース出力例

```json
{
  "summary": "普通の手です。 攻撃路を開拓しています。",
  "tags": ["筋を開ける", "序盤"],
  "confidence": 0.85,
  "method": "rule_based"
}
```

### LLM改善後出力例

```json
{
  "summary": "歩を突いて角道を開放する基本的な序盤手順。今後の攻めの布石となる重要な一手です。",
  "tags": ["筋を開ける", "序盤"],
  "confidence": 0.95,
  "method": "llm_enhanced"
}
```

## テスト・デバッグ

### テストスイート実行

```bash
python3 test_ai_reasoning.py
```

テスト内容：
- 特徴抽出機能
- ルールベース推論
- LLM推論（APIキー設定時）
- API統合

### デバッグコマンド

```python
# システムテスト
from backend.ai.reasoning import test_reasoning_system
result = test_reasoning_system()
print(result)

# 設定確認
from backend.ai.reasoning import configure_reasoning_system
configure_reasoning_system(use_llm=True, llm_provider="gemini")
```

## Docker使用時

Docker環境では `.env` ファイルの環境変数が自動的に読み込まれます：

```bash
# コンテナ起動
docker-compose up

# 環境変数確認
docker exec -it container_name env | grep LLM
```

## パフォーマンス

- **ルールベース**: ~1-5ms/手
- **LLM併用**: ~100-500ms/手（API呼び出し含む）
- **バッチ処理**: 重要な手のみLLM適用で効率化

## 制限事項

- LLMのレート制限に注意
- API障害時は自動的にルールベースにフォールバック
- USI形式の駒の動きから戦術判定（完全ではない）

## 今後の拡張

1. **詳細な盤面解析**: 盤面状態を考慮した精密な特徴抽出
2. **学習機能**: ユーザーフィードバックに基づく改善
3. **多言語対応**: 英語、中国語などの説明生成
4. **カスタマイズ**: ユーザー別の説明スタイル調整

## 貢献

このAI推論システムは、将棋の初心者から上級者まで、より深い理解を促進することを目的としています。バグレポートや機能提案をお待ちしています。