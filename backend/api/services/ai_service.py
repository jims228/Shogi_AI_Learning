import os
import time
from typing import List, Optional, Dict, Any, Tuple

import google.generativeai as genai
from backend.api.utils.shogi_utils import ShogiUtils, StrategyAnalyzer

from backend.api.utils.shogi_explain_core import (
    build_explain_facts,
    render_rule_based_explanation,
    rewrite_with_gemini,
)

GENAI_API_KEY = os.environ.get("GEMINI_API_KEY")
if GENAI_API_KEY:
    genai.configure(api_key=GENAI_API_KEY)

USE_EXPLAIN_V2 = os.getenv("USE_EXPLAIN_V2", "0") == "1"
USE_GEMINI_REWRITE = os.getenv("USE_GEMINI_REWRITE", "1") == "1"

# --- 超軽量キャッシュ（同局面で連打しても課金しない） ---
_EXPLAIN_CACHE: Dict[str, Tuple[float, str]] = {}
_EXPLAIN_CACHE_TTL_SEC = int(os.getenv("EXPLAIN_CACHE_TTL_SEC", "600"))


def _cache_get(key: str) -> Optional[str]:
    v = _EXPLAIN_CACHE.get(key)
    if not v:
        return None
    ts, text = v
    if time.time() - ts > _EXPLAIN_CACHE_TTL_SEC:
        _EXPLAIN_CACHE.pop(key, None)
        return None
    return text


def _cache_set(key: str, text: str) -> None:
    # 雑に増えすぎないように上限
    if len(_EXPLAIN_CACHE) > 500:
        _EXPLAIN_CACHE.clear()
    _EXPLAIN_CACHE[key] = (time.time(), text)


class AIService:
    @staticmethod
    async def generate_shogi_explanation(data: Dict[str, Any]) -> str:
        """
        既存を壊さず、新方式は feature flag で切り替える
        """
        cache_key = str(
            {
                "v2": USE_EXPLAIN_V2,
                "sfen": data.get("sfen"),
                "ply": data.get("ply"),
                "turn": data.get("turn"),
                "explain_level": data.get("explain_level"),
                "delta_cp": data.get("delta_cp"),
                "bestmove": data.get("bestmove"),
                "pv": data.get("pv"),
                "user_move": data.get("user_move"),
                "cands": [
                    (
                        c.get("move"),
                        c.get("score_cp"),
                        c.get("score_mate"),
                        c.get("pv"),
                    )
                    for c in (data.get("candidates") or [])
                ][:3],
            }
        )
        hit = _cache_get(cache_key)
        if hit:
            return hit

        # v2 OFF なら完全に旧挙動
        if not USE_EXPLAIN_V2:
            text = await AIService._generate_shogi_explanation_legacy(data)
            _cache_set(cache_key, text)
            return text

        # v2 ON（失敗したら旧へフォールバック）
        try:
            text = await AIService._generate_shogi_explanation_v2(data)
            _cache_set(cache_key, text)
            return text
        except Exception as e:
            print("[ExplainV2] error -> fallback legacy:", e)
            text = await AIService._generate_shogi_explanation_legacy(data)
            _cache_set(cache_key, text)
            return text

    @staticmethod
    async def _generate_shogi_explanation_v2(data: Dict[str, Any]) -> str:
        # 1) 事実抽出（嘘をつけない）
        facts = build_explain_facts(data)

        # 2) まずはルールベース文章（LLMなしで成立）
        base = render_rule_based_explanation(facts)

        # 3) LLMは“必要なときだけ”（コスト削減）
        use_rewrite = os.getenv("USE_GEMINI_REWRITE", "1") == "1"
        mate = (
            (facts.get("score") or {}).get("mate")
            if isinstance(facts.get("score"), dict)
            else (facts.get("score_turn") or {}).get("mate")
        )

        need_rewrite = use_rewrite and (
            (facts.get("level") != "beginner")
            or (facts.get("user_move") and facts.get("bestmove") and facts["user_move"] != facts.get("bestmove"))
            or bool(facts.get("candidates"))
            or (mate not in (None, 0))
        )

        if GENAI_API_KEY and need_rewrite:
            rewritten = await rewrite_with_gemini(base, facts)
            if rewritten:
                return rewritten

        return base

    @staticmethod
    async def _generate_shogi_explanation_legacy(data: Dict[str, Any]) -> str:
        """
        既存の生成を丸ごと残す（旧方式）
        """
        if not GENAI_API_KEY:
            return "APIキーが設定されていません。環境変数 GEMINI_API_KEY を確認してください。"

        ply = data.get("ply", 0)
        turn = data.get("turn", "b")
        bestmove = data.get("bestmove", "")
        score_cp = data.get("score_cp")
        score_mate = data.get("score_mate")
        history: List[str] = data.get("history", [])
        sfen = data.get("sfen", "")

        strategy = StrategyAnalyzer.analyze_sfen(sfen)
        bestmove_jp = ShogiUtils.format_move_label(bestmove, turn)

        phase = "序盤" if ply < 24 else "終盤" if ply > 100 else "中盤"
        perspective = "先手" if turn == "b" else "後手"

        score_desc = "互角"
        if score_mate:
            score_desc = "詰みあり"
        elif score_cp is not None:
            sc = score_cp
            if abs(sc) > 2000:
                score_desc = "勝勢"
            elif abs(sc) > 800:
                score_desc = "優勢" if sc > 0 else "劣勢"
            elif abs(sc) > 300:
                score_desc = "有利" if sc > 0 else "不利"

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
1. 局面ダイジェスト
2. この一手の狙い
3. 次の方針
"""

        model = genai.GenerativeModel("gemini-1.5-flash")
        res = await model.generate_content_async(prompt)
        return res.text

    @staticmethod
    async def generate_game_digest(data: Dict[str, Any]) -> str:
        if not GENAI_API_KEY:
            return "APIキーが設定されていません。"
        try:
            total_moves = data.get("total_moves", 0)
            eval_history = data.get("eval_history", [])
            step = max(1, len(eval_history) // 20)
            eval_summary = [f"{i}手:{v}" for i, v in enumerate(eval_history) if i % step == 0]

            prompt = f"""
将棋の対局データを元に、観戦記風の総評レポート（400文字程度）を作成してください。
- 総手数: {total_moves}手
- 評価値推移: {', '.join(eval_summary)}
【構成】
1. 序盤 2. 中盤 3. 終盤 4. 総括
"""
            model = genai.GenerativeModel("gemini-1.5-flash")
            response = await model.generate_content_async(prompt)
            return response.text
        except Exception as e:
            error_msg = str(e)
            if "429" in error_msg:
                return "レポート生成の利用制限に達しました。しばらく待ってから再度お試しください。"
            return f"レポート生成中にエラーが発生しました: {error_msg}"
