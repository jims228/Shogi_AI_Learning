import os
import sys

# importが通らない環境用（必要なら）
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from backend.api.utils import shogi_explain_core as core


def test_build_explain_facts_no_target_move_safe():
    req = {
        "sfen": "startpos",
        "turn": "b",
        "bestmove": "",
        "user_move": None,
        "candidates": [],
        "pv": "",
    }
    f = core.build_explain_facts(req)
    assert f["target_move"] == ""
    assert "flags" in f
    assert f["flags"]["captured_kind_hand"] is None


def test_pv_moves_regenerated_from_candidate_pv():
    req = {
        "sfen": "startpos",
        "turn": "b",
        "bestmove": "",
        "pv": "",  # ここが空でも候補から補完される想定
        "candidates": [
            {"move": "7g7f", "pv": "7g7f 3c3d", "score_cp": 50, "score_mate": None},
        ],
    }
    f = core.build_explain_facts(req)
    assert f["pv"] == "7g7f 3c3d"
    assert f["pv_moves"] == ["7g7f", "3c3d"]
    assert len(f["pv_jp"]) == 2
    assert f["pv_jp"][0].startswith("▲")
    assert f["pv_jp"][1].startswith("△")


def test_capture_promoted_piece_is_reported_as_hand_kind_in_text():
    # 白の「と(+p)」を、先手飛車が取る局面
    board = "4k4/9/9/9/9/9/4+p4/4R4/4K4"
    req = {
        "sfen": f"sfen {board} b - 1",
        "turn": "b",
        "user_move": "5h5g",
        "candidates": [],
        "pv": "",
    }
    f = core.build_explain_facts(req)
    assert f["flags"]["captured_kind"] == "+P"
    assert f["flags"]["captured_kind_hand"] == "P"

    text = core.render_rule_based_explanation(f)
    assert "歩を取って" in text
    assert "とを取って" not in text
