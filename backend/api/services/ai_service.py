import os
import google.generativeai as genai
from backend.api.utils.shogi_utils import format_move_label, StrategyAnalyzer

# API Key setup
API_KEY = os.getenv("GEMINI_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)

class AIService:
    @staticmethod
    async def generate_shogi_explanation(data: dict) -> str:
        if not API_KEY:
            return "APIキーが設定されていません。"

        try:
            sfen = data.get("sfen", "")
            ply = data.get("ply", 0)
            bestmove = data.get("bestmove", "")
            score_cp = data.get("score_cp")
            score_mate = data.get("score_mate")
            pv = data.get("pv", "")
            turn = data.get("turn", "b")
            history = data.get("history", [])
            user_move = data.get("user_move")

            try:
                analyzer = StrategyAnalyzer(sfen)
                strategy = analyzer.analyze()
            except Exception:
                strategy = "不明"
            
            bestmove_label = format_move_label(bestmove, turn)
            
            # PV formatting
            pv_moves = pv.split(" ")[:5]
            pv_labels = [format_move_label(m, turn if i%2==0 else ("w" if turn=="b" else "b")) for i, m in enumerate(pv_moves)]
            pv_text = " ".join(pv_labels)

            score_text = ""
            if score_mate:
                score_text = f"詰み {score_mate}手"
            elif score_cp is not None:
                score_text = f"評価値 {score_cp}"

            # Use gemini-2.0-flash as requested
            model = genai.GenerativeModel('models/gemini-2.0-flash')
            
            prompt = ""
            if user_move and user_move != bestmove:
                user_move_label = format_move_label(user_move, turn)
                prompt = f'''
                あなたは将棋のプロ棋士（指導者）です。以下の情報をもとに、ユーザーの手とAIの推奨手を比較して解説してください。

                [局面情報]
                戦型: {strategy}
                現在の手数: {ply}手目
                手番: {"先手" if turn == "b" else "後手"}
                
                AIの推奨手: {bestmove_label}
                ユーザーの手: {user_move_label}
                評価値: {score_text}
                推奨手の読み筋: {pv_text}

                [解説のスタイル]
                「AIは『{bestmove_label}』を推奨しています。あなたの手『{user_move_label}』は、{pv_text}という展開と比較すると形勢が悪くなるため、悪手と言えます。（具体的な理由）なので、こちらの定跡（手筋）が良いですよ」
                といった口調で、優しく、しかし論理的に指摘してください。
                '''
            else:
                prompt = f'''
                あなたは将棋のプロ棋士（指導者）です。以下の情報をもとに、この局面の最善手について解説してください。

                [局面情報]
                戦型: {strategy}
                現在の手数: {ply}手目
                手番: {"先手" if turn == "b" else "後手"}
                
                最善手: {bestmove_label}
                評価値: {score_text}
                読み筋: {pv_text}

                [解説のスタイル]
                「この局面では『{bestmove_label}』を指したいね！なぜなら～」
                という形式で、明るく提案するように解説してください。
                '''

            # Use async generation
            response = await model.generate_content_async(prompt)
            return response.text

        except Exception as e:
            print(f"Gemini API Error: {e}")
            return "申し訳ありません、現在AI解説を利用できません（混み合っています）。"

    @staticmethod
    async def generate_game_digest(data: dict) -> str:
        if not API_KEY:
            return "APIキーが設定されていません。"
            
        try:
            total_moves = data.get("total_moves", 0)
            eval_history = data.get("eval_history", [])
            
            # Detect turning points
            turning_points = []
            for i in range(1, len(eval_history)):
                diff = eval_history[i] - eval_history[i-1]
                if abs(diff) > 400:
                    turning_points.append(f"{i}手目 (評価値変動: {diff})")
            
            turning_points_text = ", ".join(turning_points[:5])

            model = genai.GenerativeModel('models/gemini-2.0-flash')
            prompt = f'''
            将棋の対局レポートを作成してください。
            総手数: {total_moves}手
            勝負所（評価値が大きく動いた局面）: {turning_points_text}
            
            全体を通しての流れ、勝敗を分けたポイント、どのような将棋だったかを要約してください。
            '''
            
            response = await model.generate_content_async(prompt)
            return response.text

        except Exception as e:
            print(f"Gemini API Error: {e}")
            return "レポート生成に失敗しました。"
