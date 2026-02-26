"""Test rule-based shogi explanation (no LLM required)."""
import os
import asyncio

from backend.api.utils.shogi_explain_core import (
    build_explain_facts,
    render_rule_based_explanation,
    rewrite_with_gemini,
)


def test_build_explain_facts_minimal():
    """Minimal req to build_explain_facts should succeed."""
    req = {
        "sfen": "position startpos",
        "ply": 1,
        "turn": "b",
        "bestmove": "7g7f",
        "user_move": "7g7f",
        "score_cp": 50,
        "pv": "7g7f 3c3d",
        "explain_level": "beginner",
    }
    facts = build_explain_facts(req)
    assert isinstance(facts, dict)
    assert facts["level"] == "beginner"
    assert facts["ply"] == 1
    assert facts["turn"] == "b"
    assert facts["target_move"] == "7g7f"


def test_render_rule_based_explanation_contains_markers():
    """Rule-based explanation should contain expected markers even without LLM."""
    req = {
        "sfen": "position startpos",
        "ply": 2,
        "turn": "b",
        "bestmove": "7g7f",
        "user_move": "7g7f",
        "score_cp": 50,
        "pv": "7g7f 3c3d",
        "explain_level": "beginner",
    }
    facts = build_explain_facts(req)
    text = render_rule_based_explanation(facts)

    assert isinstance(text, str)
    assert len(text) > 0
    assert "【この一手】" in text
    assert "【状況】" in text


def test_rewrite_with_gemini_off():
    """When USE_LLM is off, rewrite_with_gemini should return None."""
    old_val = os.environ.get("USE_LLM")
    old_val2 = os.environ.get("USE_LLM_REWRITE")
    try:
        os.environ["USE_LLM"] = "0"
        os.environ["USE_LLM_REWRITE"] = "0"
        base_text = "【この一手】7g7f\n【状況】序盤"
        facts = {"level": "beginner"}
        result = asyncio.run(rewrite_with_gemini(base_text, facts))
        assert result is None
    finally:
        if old_val is None:
            os.environ.pop("USE_LLM", None)
        else:
            os.environ["USE_LLM"] = old_val
        if old_val2 is None:
            os.environ.pop("USE_LLM_REWRITE", None)
        else:
            os.environ["USE_LLM_REWRITE"] = old_val2


def test_render_explanation_includes_pv():
    """Rendered explanation should include PV info when available."""
    req = {
        "sfen": "position startpos",
        "ply": 1,
        "turn": "b",
        "bestmove": "7g7f",
        "user_move": "7g7f",
        "score_cp": 0,
        "pv": "7g7f 3c3d 2g2f",
        "explain_level": "beginner",
    }
    facts = build_explain_facts(req)
    text = render_rule_based_explanation(facts)

    assert "【読み筋】" in text  # PVがあるので読み筋が出る想定


def test_render_explanation_advanced_level():
    """Advanced level should produce more detailed explanation."""
    req = {
        "sfen": "position startpos",
        "ply": 5,
        "turn": "b",
        "bestmove": "2g2f",
        "user_move": "2g2f",
        "score_cp": 120,
        "delta_cp": 70,
        "pv": "2g2f 8c8d 7g7f",
        "explain_level": "advanced",
        "candidates": [
            {"move": "2g2f", "score_cp": 120, "pv": "2g2f 8c8d 7g7f"},
            {"move": "7g7f", "score_cp": 50, "pv": "7g7f 3c3d 2g2f"},
        ],
    }
    facts = build_explain_facts(req)
    text = render_rule_based_explanation(facts)

    assert isinstance(text, str)
    assert len(text) > 0
    assert "【根拠" in text  # advancedは根拠セクションが出る


# ---------------------------------------------------------------------------
# generate_shogi_explanation_payload: db_refs キーが含まれること
# ---------------------------------------------------------------------------

def test_generate_payload_has_db_refs_key():
    """
    /api/explain に相当する payload に db_refs キーが含まれること。
    LLM 不要（USE_EXPLAIN_V2 は問わない）。
    """
    import asyncio
    from backend.api.services.ai_service import AIService

    req = {
        "sfen": "position sfen lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1",
        "ply": 0,
        "turn": "b",
        "bestmove": "7g7f",
        "score_cp": 50,
        "pv": "7g7f 3c3d",
        "explain_level": "beginner",
    }
    # USE_EXPLAIN_V2=1 でルールベース (LLMなし) に固定
    old_v2 = os.environ.get("USE_EXPLAIN_V2")
    old_rewrite = os.environ.get("USE_GEMINI_REWRITE")
    try:
        os.environ["USE_EXPLAIN_V2"] = "1"
        os.environ["USE_GEMINI_REWRITE"] = "0"
        # モジュールレベルの flag を再評価させる
        import importlib
        import backend.api.services.ai_service as svc
        importlib.reload(svc)

        payload = asyncio.run(svc.AIService.generate_shogi_explanation_payload(req))
    finally:
        if old_v2 is None:
            os.environ.pop("USE_EXPLAIN_V2", None)
        else:
            os.environ["USE_EXPLAIN_V2"] = old_v2
        if old_rewrite is None:
            os.environ.pop("USE_GEMINI_REWRITE", None)
        else:
            os.environ["USE_GEMINI_REWRITE"] = old_rewrite

    assert "db_refs" in payload, "payload must contain db_refs key"
    db_refs = payload["db_refs"]
    assert isinstance(db_refs, dict)
    assert "hit" in db_refs
    assert "items" in db_refs
    assert isinstance(db_refs["items"], list)
