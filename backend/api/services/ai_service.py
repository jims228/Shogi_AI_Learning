import os
import google.generativeai as genai
from typing import List, Optional, Dict, Any
from backend.api.utils.shogi_utils import ShogiUtils, StrategyAnalyzer

# 環境変数からAPIキーを取得
GENAI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)

class AIService:
    @staticmethod
    async def generate_shogi_explanation(data: Dict[str, Any]) -> str:
        """
        局面の解説を生成する
        data: {
            sfen: str, ply: int, bestmove: str, score_cp: int, score_mate: int,
            pv: str, turn: str, history: List[str]
        }
        """
        if not GENAI_API_KEY:
            return "APIキーが設定されていません。環境変数 GEMINI_API_KEY を確認してください。"

        try:
            ply = data.get("ply", 0)
            turn = data.get("turn", "b")
            bestmove = data.get("bestmove", "")
            score_cp = data.get("score_cp")
            score_mate = data.get("score_mate")
            history = data.get("history", [])
            sfen = data.get("sfen", "")

            # 戦型判定
            strategy = StrategyAnalyzer.analyze_sfen(sfen)
            
            # 指し手の日本語化
            bestmove_jp = ShogiUtils.format_move_label(bestmove, turn)
            
            phase = "序盤" if ply < 24 else "終盤" if ply > 100 else "中盤"
            perspective = "先手" if turn == "b" else "後手"
            
            score_desc = "互角"
            if score_mate:
                score_desc = "詰みあり"
            elif score_cp is not None:
                sc = score_cp
                if abs(sc) > 2000: score_desc = "勝勢"
                elif abs(sc) > 800: score_desc = "優勢" if sc > 0 else "劣勢"
                elif abs(sc) > 300: score_desc = "有利" if sc > 0 else "不利"

            history_str = " -> ".join(history[-5:]) if history else "初手"

            prompt = f"""
            あなたはプロの将棋解説者です。以下の局面を**{perspective}視点**で、初心者にも分かりやすく解説してください。
            
            【局面情報】
            - 手数: {ply}手目 ({phase})
            - 戦型目安: {strategy}
            - 形勢: {score_desc} (評価値: {score_cp if score_cp is not None else 'Mate'})
            - AI推奨手: {bestmove_jp} ({bestmove})
            - 直近の進行: {history_str}

            【指示】
            1. **局面ダイジェスト**: 現在の状況を簡潔に（「〜戦模様」「〜が攻め込んでいる」など）。
            2. **この一手**: AI推奨手「{bestmove_jp}」がなぜ良いのか、狙いは何か。
            3. **アドバイス**: 次の方針や気をつけるべき点。
            
            専門用語には簡単な補足を入れ、励ますような口調で書いてください。
            """

            model = genai.GenerativeModel('gemini-1.5-flash')
            response = await model.generate_content_async(prompt)
            return response.text

        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg:
                return "申し訳ありません。AI解説の利用制限に達しました。しばらく待ってから再度お試しください。"
            return f"解説の生成中にエラーが発生しました: {error_msg}"

    @staticmethod
    async def generate_game_digest(data: Dict[str, Any]) -> str:
        """
        対局全体のレポートを作成する
        data: { total_moves: int, eval_history: List[int], winner: str }
        """
        if not GENAI_API_KEY:
            return "APIキーが設定されていません。"

        try:
            total_moves = data.get("total_moves", 0)
            eval_history = data.get("eval_history", [])
            
            # 評価値のサマリーを作成（間引き）
            step = max(1, len(eval_history) // 20)
            eval_summary = [f"{i}手:{v}" for i, v in enumerate(eval_history) if i % step == 0]
            
            prompt = f"""
            将棋の対局データを元に、観戦記風の総評レポート（400文字程度）を作成してください。
            
            - 総手数: {total_moves}手
            - 評価値推移: {', '.join(eval_summary)}
            
            【構成】
            1. **序盤**: どのような立ち上がりだったか。
            2. **中盤**: 形勢が動いたポイント（評価値が大きく変動した箇所があれば言及）。
            3. **終盤**: 決着の要因。
            4. **総括**: 両対局者へのコメント。
            """

            model = genai.GenerativeModel('gemini-1.5-flash')
            response = await model.generate_content_async(prompt)
            return response.text

        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg:
                return "レポート生成の利用制限に達しました。しばらく待ってから再度お試しください。"
            return f"レポート生成中にエラーが発生しました: {error_msg}"
