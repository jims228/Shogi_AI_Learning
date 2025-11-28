"""
ai_explanation.py
Geminiを使って将棋の局面解説を生成する専用モジュール
"""

import os
import google.generativeai as genai
from pydantic import BaseModel
from typing import Optional

# APIキーの設定
GENAI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)

class ExplanationInput(BaseModel):
    sfen: str
    ply: int
    bestmove: str
    score_cp: Optional[int] = None
    score_mate: Optional[int] = None
    pv: str
    turn: str  # "b" or "w"

async def generate_shogi_explanation(data: ExplanationInput) -> str:
    """
    局面データを受け取り、Gemini 1.5 Flash を使って人間らしい解説を生成する
    """
    if not GENAI_API_KEY:
        return "エラー: Gemini APIキーが設定されていません。"

    # 1. 局面のフェーズ判定
    phase = "中盤"
    if data.ply < 24:
        phase = "序盤"
    elif data.ply > 100:
        phase = "終盤"

    # 2. 評価値の言語化
    # data.score_cp は「手番側」の評価値と仮定
    situation_desc = "互角"
    score_val = data.score_cp if data.score_cp is not None else 0
    score_str = f"{score_val}"
    
    if data.score_mate:
        situation_desc = f"{abs(data.score_mate)}手以内の詰み筋に入っています（勝勢）"
    elif data.score_cp is not None:
        sc = data.score_cp
        if abs(sc) < 300: situation_desc = "形勢はほぼ互角です"
        elif sc > 2000: situation_desc = "勝勢です"
        elif sc > 800: situation_desc = "優勢です"
        elif sc < -2000: situation_desc = "敗勢です"
        elif sc < -800: situation_desc = "苦戦しています"

    # 3. プロンプト構築
    prompt = f"""
あなたはプロ棋士であり、親しみやすい将棋の解説者です。
以下の局面について、初心者～中級者に向けて「人間らしい言葉」で解説してください。
数値の羅列ではなく、「なぜその手が良いのか」「どういう狙いがあるのか」という**根拠とストーリー**を語ってください。

## 局面データ
- 手数: {data.ply}手目 ({phase})
- 手番: {"先手" if data.turn == "b" else "後手"}
- 現在の盤面(SFEN): {data.sfen}
- AI推奨手: {data.bestmove}
- AI読み筋(PV): {data.pv}
- 状況: {situation_desc} (評価値: {score_str})

## 解説のガイドライン
1. **{phase}のポイント**:
   - **序盤**: 「矢倉」「角換わり」「振り飛車」などの**戦型や定跡**について言及してください。定跡通りの進行か、工夫した手かについても触れてください。
   - **中盤**: 駒の損得だけでなく、玉の堅さ、攻めの拠点、手厚さなど**大局観**を語ってください。
   - **終盤・詰み**: 詰みがある場合は「即詰みがあります！」と明言し、詰みの手筋（頭金、退路封鎖など）を解説してください。

2. **話し方**:
   - 丁寧ですが、少し熱意のある口調で（「～ですね」「～という狙いがあります」）。
   - 難しい専門用語が出た場合は、簡単に補足してください。

3. **構成**:
   - 【状況】現在の局面の要約
   - 【推奨手】AIが示す手についての解説と根拠
   - 【展望】この後の展開予想

解説をお願いします。
"""

    try:
        # 高速なモデルを使用
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        print(f"Gemini generation error: {e}")
        return "申し訳ありません。解説の生成中にエラーが発生しました。"