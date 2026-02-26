"""
Unit tests for backend/api/db/wkbk_db.py

Tests:
- SFEN 正規化（prefix あり/なし、手数あり/なし）
- lookup_by_sfen: ヒット/未ヒット
- 著作権保護: title 等の長文を返さないこと
- 落ちない設計: 空文字/None 入力で例外しないこと
"""
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)


from backend.api.db.wkbk_db import normalize_sfen, lookup_by_sfen, WkbkDbResult, db_stats


# ---------------------------------------------------------------------------
# normalize_sfen
# ---------------------------------------------------------------------------

def test_normalize_sfen_removes_prefix_and_ply():
    raw = "position sfen lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
    result = normalize_sfen(raw)
    assert "position" not in result
    assert "sfen" not in result
    # 末尾の "1" (手数) が除去されている
    assert not result.strip().endswith("1"), f"ply should be removed, got: {result!r}"
    assert result.startswith("lnsgkgsnl/")


def test_normalize_sfen_no_prefix():
    bare = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
    result = normalize_sfen(bare)
    assert "1" not in result.split()[-1:]  # 末尾手数が除去される
    assert result.startswith("lnsgkgsnl/")


def test_normalize_sfen_prefix_without_ply():
    raw = "position sfen lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b -"
    result = normalize_sfen(raw)
    assert result == "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b -"


def test_normalize_sfen_prefix_and_bare_match():
    """prefix あり / なし で正規化後が同じになること"""
    with_prefix = "position sfen lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
    bare = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
    assert normalize_sfen(with_prefix) == normalize_sfen(bare)


# ---------------------------------------------------------------------------
# lookup_by_sfen — 基本動作
# ---------------------------------------------------------------------------

def test_lookup_empty_sfen_returns_no_hit():
    result = lookup_by_sfen("")
    assert isinstance(result, WkbkDbResult)
    assert result.hit is False


def test_lookup_none_like_empty_returns_no_hit():
    # 空文字は無ヒット
    result = lookup_by_sfen("  ")
    assert result.hit is False


def test_lookup_startpos_returns_valid_result():
    """
    平手初期局面は 定跡問題 として wkbk DB に存在する。
    結果は WkbkDbResult であること・ヒット時は lineage_key が設定されること。
    """
    sfen = "position sfen lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
    result = lookup_by_sfen(sfen)
    assert isinstance(result, WkbkDbResult)
    if result.hit:
        assert result.lineage_key is not None


def test_lookup_dummy_sfen_no_hit():
    """存在しない局面 SFEN は未ヒットになること"""
    dummy = "9/9/9/9/9/9/9/9/9 b -"
    result = lookup_by_sfen(dummy)
    assert result.hit is False


def test_lookup_known_article_hits():
    """wkbk_articles.jsonl の実在 SFEN でヒットすること"""
    # 1件目の記事: 居玉は危険 (key: a022f1d4...)
    sfen = "position sfen ln1gk2nl/6g2/p2pppspp/2p3p2/7P1/1rP6/P2PPPP1P/2G3SR1/LN2KG1NL b BSPbsp 1"
    result = lookup_by_sfen(sfen)
    assert result.hit is True
    assert result.lineage_key == "手筋"
    assert result.category_hint == "tactical pattern (tesuji)"
    assert result.author == "きなこもち"
    assert "王手飛車" in result.tags


def test_lookup_without_prefix_also_hits():
    """position sfen prefix なしでもヒットすること"""
    bare = "ln1gk2nl/6g2/p2pppspp/2p3p2/7P1/1rP6/P2PPPP1P/2G3SR1/LN2KG1NL b BSPbsp 1"
    result = lookup_by_sfen(bare)
    assert result.hit is True
    assert result.lineage_key == "手筋"


def test_lookup_without_ply_also_hits():
    """手数なし SFEN でもヒットすること"""
    no_ply = "ln1gk2nl/6g2/p2pppspp/2p3p2/7P1/1rP6/P2PPPP1P/2G3SR1/LN2KG1NL b BSPbsp"
    result = lookup_by_sfen(no_ply)
    assert result.hit is True


# ---------------------------------------------------------------------------
# 著作権保護: タイトル等の長文は返さない
# ---------------------------------------------------------------------------

def test_hit_result_has_no_title_field():
    """WkbkDbResult には title フィールドが存在してはならない"""
    sfen = "position sfen ln1gk2nl/6g2/p2pppspp/2p3p2/7P1/1rP6/P2PPPP1P/2G3SR1/LN2KG1NL b BSPbsp 1"
    result = lookup_by_sfen(sfen)
    assert result.hit is True
    assert not hasattr(result, "title"), "title フィールドは著作権保護のため返すべきでない"


def test_short_note_within_limit():
    """short_note は 80 文字以内であること"""
    from backend.api.db.wkbk_db import _SHORT_NOTE_MAX
    sfen = "position sfen ln1gk2nl/6g2/p2pppspp/2p3p2/7P1/1rP6/P2PPPP1P/2G3SR1/LN2KG1NL b BSPbsp 1"
    result = lookup_by_sfen(sfen)
    if result.short_note is not None:
        # short_note は省略記号を含んでも上限 +1 文字（"…"）以内
        assert len(result.short_note) <= _SHORT_NOTE_MAX + 1


# ---------------------------------------------------------------------------
# to_dict
# ---------------------------------------------------------------------------

def test_to_dict_hit_contains_expected_keys():
    sfen = "position sfen ln1gk2nl/6g2/p2pppspp/2p3p2/7P1/1rP6/P2PPPP1P/2G3SR1/LN2KG1NL b BSPbsp 1"
    result = lookup_by_sfen(sfen)
    assert result.hit is True
    d = result.to_dict()
    for key in ("hit", "key", "lineage_key", "tags", "difficulty", "category_hint",
                "goal_summary", "author", "short_note"):
        assert key in d, f"missing key in to_dict(): {key}"


def test_to_dict_no_hit():
    result = lookup_by_sfen("")
    d = result.to_dict()
    assert d["hit"] is False


# ---------------------------------------------------------------------------
# db_stats
# ---------------------------------------------------------------------------

def test_db_stats_loads_articles():
    stats = db_stats()
    assert "articles_loaded" in stats
    assert stats["articles_loaded"] >= 0  # ファイルがない環境でも 0 で返る
