import pytest

from backend.api.utils.shogi_explain_core import build_explain_facts
from backend.api.utils.ai_explain_json import build_explain_json_from_facts, validate_explain_json


@pytest.mark.parametrize(
    "req",
    [
        # 1) opening-ish
        {"sfen": "position startpos", "ply": 1, "turn": "b", "bestmove": "7g7f", "pv": "7g7f 3c3d", "score_cp": 0, "explain_level": "beginner"},
        {"sfen": "position startpos moves 7g7f", "ply": 2, "turn": "w", "bestmove": "3c3d", "pv": "3c3d 2g2f", "score_cp": 20, "explain_level": "beginner"},
        {"sfen": "position startpos moves 7g7f 3c3d", "ply": 3, "turn": "b", "bestmove": "2g2f", "pv": "2g2f 8c8d", "score_cp": 10, "explain_level": "beginner"},
        {"sfen": "position startpos moves 7g7f 3c3d 2g2f", "ply": 4, "turn": "w", "bestmove": "8c8d", "pv": "8c8d 2f2e", "score_cp": 0, "explain_level": "beginner"},
        # 2) capture / check-like patterns (we only test schema+consistency, not legality)
        {"sfen": "position startpos", "ply": 1, "turn": "b", "bestmove": "8h2b+", "pv": "8h2b+ 3a2b", "score_cp": 0, "explain_level": "advanced"},
        {"sfen": "position startpos", "ply": 1, "turn": "b", "bestmove": "2h2f", "pv": "2h2f 8b8d", "score_cp": 30, "explain_level": "intermediate"},
        {"sfen": "position startpos", "ply": 1, "turn": "b", "bestmove": "5i6h", "pv": "5i6h 5a4b", "score_cp": 5, "explain_level": "beginner"},
        {"sfen": "position startpos", "ply": 1, "turn": "b", "bestmove": "2g2f", "pv": "2g2f 3c3d 2f2e", "score_cp": -10, "explain_level": "beginner"},
        # 3) mate eval cases (must be allowed to mention mate)
        {"sfen": "position startpos", "ply": 1, "turn": "b", "bestmove": "7g7f", "pv": "7g7f 3c3d", "score_mate": 7, "explain_level": "advanced"},
        {"sfen": "position startpos", "ply": 1, "turn": "b", "bestmove": "7g7f", "pv": "7g7f 3c3d", "score_mate": -5, "explain_level": "advanced"},
    ],
)
def test_explain_json_is_consistent(req):
    facts = build_explain_facts(req)
    ej = build_explain_json_from_facts(facts)
    parsed, errors = validate_explain_json(ej.model_dump(), facts)
    assert errors == []
    assert parsed is not None

    # Must align with bestmove and PV prefix if PV exists.
    if facts.get("bestmove") and (facts.get("pv_moves") or []):
        assert parsed.pvGuide == [] or parsed.pvGuide[0].move == facts["bestmove"]


