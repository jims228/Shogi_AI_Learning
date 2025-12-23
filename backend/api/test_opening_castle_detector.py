import pytest

from backend.ai.opening_detector import detect_opening_bundle
from backend.ai.castle_detector import detect_castle_bundle
from backend.api.utils.shogi_explain_core import parse_position_cmd


KANJI_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"]


def board_part_from_placements(placements):
    """
    placements: list of (pieceChar, file, rank)
      - file: 1..9 (right->left)
      - rank: 1..9 (top->bottom)
    pieceChar: 'K','k','R','r','G','g','S','s', etc
    """
    board = [[None for _ in range(9)] for _ in range(9)]
    for piece, file_, rank_ in placements:
        x = 9 - int(file_)
        y = int(rank_) - 1
        board[y][x] = piece

    rows = []
    for y in range(9):
        run = 0
        parts = []
        for x in range(9):
            p = board[y][x]
            if p is None:
                run += 1
            else:
                if run:
                    parts.append(str(run))
                    run = 0
                parts.append(p)
        if run:
            parts.append(str(run))
        rows.append("".join(parts) if parts else "9")
    return "/".join(rows)


@pytest.mark.parametrize(
    "side, rook_file, expected_style, expected_opening",
    [
        ("b", 2, "ibisha", "unknown"),
        ("b", 6, "furibisha", "shikenbisha"),
        ("b", 7, "furibisha", "sankenbisha"),
        ("b", 5, "furibisha", "nakabisha"),
        ("b", 8, "furibisha", "mukai-bisha"),
        ("w", 8, "ibisha", "unknown"),
        ("w", 4, "furibisha", "shikenbisha"),
        ("w", 3, "furibisha", "sankenbisha"),
        ("w", 5, "furibisha", "nakabisha"),
        ("w", 2, "furibisha", "mukai-bisha"),
    ],
)
def test_style_and_furibisha_subtype_by_rook_file(side, rook_file, expected_style, expected_opening):
    # minimal board: kings + rook
    # Put rook on rank 8 for sente, rank 2 for gote (typical home ranks).
    rook_rank = 8 if side == "b" else 2
    piece = "R" if side == "b" else "r"
    board_part = board_part_from_placements(
        [
            ("K", 5, 9),
            ("k", 5, 1),
            (piece, rook_file, rook_rank),
        ]
    )
    cmd = f"position sfen {board_part} {side} - 1"
    pos = parse_position_cmd(cmd)
    bundle = detect_opening_bundle(pos.board, pos.moves, side)

    assert bundle["style"]["id"] == expected_style
    # opening may be unknown even when style is furibisha if rook on uncommon file
    assert bundle["opening"]["id"] == expected_opening
    # reasons must exist when not unknown
    if bundle["style"]["id"] != "unknown":
        assert bundle["style"]["reasons"]


def test_kakugawari_detected_from_moves_when_ibisha():
    pos = parse_position_cmd("position startpos moves 7g7f 3c3d 8h2b+ 3a2b")
    # side to move after 4 plies: b
    bundle = detect_opening_bundle(pos.board, pos.moves, "b")
    assert bundle["opening"]["id"] == "kaku-gawari"
    assert bundle["opening"]["reasons"]


@pytest.mark.parametrize(
    "side, king_sq, golds, silvers, expected_castle",
    [
        # anaguma (sente)
        ("b", (1, 9), [(2, 8)], [], "anaguma"),
        # anaguma (gote)
        ("w", (9, 1), [(8, 2)], [], "anaguma"),
        # mino (sente side: left-ish)
        ("b", (8, 9), [(7, 8)], [(8, 8)], "mino"),
        # mino (gote mirror)
        ("w", (2, 1), [(3, 2)], [(2, 2)], "mino"),
        # funagakoi (sente)
        ("b", (6, 9), [(6, 8), (7, 8)], [], "funagakoi"),
        # funagakoi (gote)
        ("w", (4, 1), [(4, 2), (3, 2)], [], "funagakoi"),
        # yagura (sente)
        ("b", (5, 9), [(6, 8)], [(6, 7), (7, 7)], "yagura"),
        # yagura (gote)
        ("w", (5, 1), [(4, 2)], [(4, 3), (3, 3)], "yagura"),
    ],
)
def test_castle_shapes(side, king_sq, golds, silvers, expected_castle):
    placements = [("K", 5, 9), ("k", 5, 1)]
    # overwrite king for side
    if side == "b":
        placements[0] = ("K", king_sq[0], king_sq[1])
    else:
        placements[1] = ("k", king_sq[0], king_sq[1])
    for f, r in golds:
        placements.append(("G" if side == "b" else "g", f, r))
    for f, r in silvers:
        placements.append(("S" if side == "b" else "s", f, r))

    board_part = board_part_from_placements(placements)
    cmd = f"position sfen {board_part} {side} - 1"
    pos = parse_position_cmd(cmd)
    bundle = detect_castle_bundle(pos.board, side)
    assert bundle["castle"]["id"] == expected_castle
    assert bundle["castle"]["reasons"]


def test_unknown_when_king_missing():
    # no kings -> unknown
    board_part = board_part_from_placements([("R", 2, 8)])
    cmd = f"position sfen {board_part} b - 1"
    pos = parse_position_cmd(cmd)
    bundle = detect_castle_bundle(pos.board, "b")
    assert bundle["castle"]["id"] == "unknown"


