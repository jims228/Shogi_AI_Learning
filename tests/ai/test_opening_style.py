"""Opening style detection tests (盤面ベース)"""

import pytest

try:
    import shogi
    HAS_SHOGI = True
except ImportError:
    HAS_SHOGI = False


def push_move(board, move_usi: str):
    mv = shogi.Move.from_usi(move_usi)

    # 違法手を握りつぶさない
    if hasattr(board, "is_legal"):
        assert board.is_legal(mv), f"illegal move: {move_usi} (sfen={board.sfen()})"
    else:
        assert mv in list(board.legal_moves), f"illegal move: {move_usi} (sfen={board.sfen()})"

    board.push(mv)


from backend.ai.reasoning_features import detect_opening_style


@pytest.mark.skipif(not HAS_SHOGI, reason="python-shogi not available")
class TestOpeningStyleDetection:
    """盤面ベースの戦型判定テスト"""
    
    def test_sente_chuuokisha(self):
        """先手中飛車の判定"""
        # startpos から中飛車への典型的な進行：2h5h
        moves = ["2g2f", "8c8d", "2f2e", "8d8e", "2h5h"]  # 先手が2hから5hに移動
        ply = len(moves)
        
        board = shogi.Board()
        for m in moves:
            push_move(board, m)
        
        result = detect_opening_style(ply, moves, board)
        
        assert result["style"] == "振り飛車"
        assert result["subtype"] == "中飛車"
        assert result["side"] == "black"
        assert result["confidence"] >= 0.8
        assert len(result["reasons"]) > 0
        assert result["features"].get("sente_rook_file") == 5
    
    def test_gote_rangedgyokasha(self):
        """後手中飛車の判定（後手のみ振り飛車）"""
        # 後手飛車を 5筋へ（8b -> 5b）
        moves = [
            "2g2f",
            "8b5b",
        ]
        ply = len(moves)
        board = shogi.Board()
        for m in moves:
            push_move(board, m)
        
        result = detect_opening_style(ply, moves, board)
        
        assert result["style"] == "振り飛車"
        assert result["subtype"] == "中飛車"
        assert result["side"] == "white"
        assert result["confidence"] >= 0.8
    
    def test_sente_sankengyokasha(self):
        """先手三間飛車の判定"""
        moves = [
            "2g2f", "8c8d",
            "2f2e", "8d8e",
            "2h7h",  # 先手が2hから7hに移動（三間）
        ]
        ply = len(moves)
        
        board = shogi.Board()
        for m in moves:
            push_move(board, m)
        
        result = detect_opening_style(ply, moves, board)
        
        assert result["style"] == "振り飛車"
        assert result["subtype"] == "三間飛車"
        assert result["side"] == "black"
        assert result["confidence"] >= 0.8
        assert result["features"].get("sente_rook_file") == 7
    
    def test_aibushin_kyoku_valid(self):
        """相振り飛車の判定（修正版：有効な手順）"""
        # 相振り飛車：先手=5筋、後手=6筋（黒基準）
        moves = [
            "2h5h",  # 先手が5hに（中飛車）
            "8b4b",  # 後手が8bから4bに（白基準4筋）→ 黒基準6筋
        ]
        ply = len(moves)
        board = shogi.Board()
        for m in moves:
            push_move(board, m)
        
        result = detect_opening_style(ply, moves, board)
        
        # 両者が振り飛車 → 相振り飛車
        assert result["style"] == "相振り飛車"
        assert result["confidence"] >= 0.7
        assert result["side"] == "both"
    
    def test_igyokasha_valid(self):
        """居飛車（飛車が動かない場合 - 修正版）"""
        # 8手以上で飛車が動かない場合は confidence >= 0.65 で検出される
        moves = [
            # 合法手のみで8手進める（飛車は一切動かさない）
            "7g7f", "3c3d",
            "2g2f", "8c8d",
            "2f2e", "4c4d",
            "3g3f", "5c5d",  # 8手で飛車は動かない
        ]
        ply = len(moves)
        board = shogi.Board()
        for m in moves:
            push_move(board, m)
        
        result = detect_opening_style(ply, moves, board)
        
        # ply >= 8 で飛車が動いていなければ confidence >= 0.65 で居飛車判定
        assert result["style"] == "居飛車"
        assert result["confidence"] >= 0.65
        assert result["detected"] == True  # detected = (style != "unknown") and (confidence >= 0.6)
    
    def test_kakuwagawari_detection(self):
        """角交換が起きる進行でも戦型判定が壊れない（現状は居飛車扱い）"""
        # detect_opening_style は角換わり自体は判定しないため、
        # 「角交換が起きても例外なく安定して戦型（居飛車）を返す」ことを検証する。
        moves = [
            "7g7f", "3c3d",
            "8h2b+", "3a2b",  # 角交換（双方の角が持ち駒になる）
            "2g2f", "8c8d",
            "2f2e", "4c4d",
        ]
        
        board = shogi.Board()
        for m in moves:
            push_move(board, m)
        
        result = detect_opening_style(len(moves), moves, board)

        assert result["style"] == "居飛車"
        assert result["confidence"] >= 0.65
        assert result["detected"] is True
    
    def test_ply_over_30_confidence_penalty(self):
        """ply > 30 の場合 confidence が低下"""
        moves = [
            "2g2f", "8c8d",
            "2f2e", "8d8e",
            "2h5h",
        ]
        
        board = shogi.Board()
        for m in moves:
            push_move(board, m)
        
        # ply = 40
        result = detect_opening_style(40, moves, board)
        
        # ply > 30 なので confidence < 0.6 になるはず
        assert result["style"] == "unknown" or result["confidence"] < 0.6
    
    def test_fallback_without_board(self):
        """board が None の場合はフォールバック"""
        moves = ["2h5h", "8c8d", "5h5e"]
        ply = len(moves)
        
        result = detect_opening_style(ply, moves, board=None)
        
        # フォールバックでも何か返す
        assert result["style"] in ["振り飛車", "居飛車", "相振り飛車", "unknown"]
        assert 0.0 <= result["confidence"] <= 1.0
    
    def test_confidence_below_threshold_returns_unknown(self):
        """confidence < 0.6 の場合は unknown を返す"""
        moves = ["2g2f", "8c8d"]
        ply = len(moves)
        
        board = shogi.Board()
        for m in moves:
            push_move(board, m)
        
        result = detect_opening_style(ply, moves, board)
        
        # 2手では判定がつかないはず
        if result["confidence"] < 0.6:
            assert result["style"] == "unknown"


@pytest.mark.skipif(not HAS_SHOGI, reason="python-shogi not available")
class TestOpeningStyleIntegration:
    """戦型判定の統合テスト"""
    
    def test_multiple_ply_detection(self):
        """複数ply の判定結果の遷移"""
        moves = [
            "2g2f", "8c8d",
            "2f2e", "8d8e",
            "2h5h",  # 中飛車へ
        ]
        
        board = shogi.Board()
        results = []
        
        for i in range(1, len(moves) + 1):
            board_copy = shogi.Board()
            for m in moves[:i]:
                push_move(board_copy, m)
            
            result = detect_opening_style(i, moves[:i], board_copy)
            results.append(result)
        
        # 最初の数手は判定がつかない
        assert results[0]["style"] == "unknown"
        
        # 最後の手では振り飛車と判定される
        assert results[-1]["style"] == "振り飛車"
        assert results[-1]["subtype"] == "中飛車"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
