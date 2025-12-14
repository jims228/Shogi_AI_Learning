import re

class ShogiUtils:
    KANJI_NUM = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九"]
    PIECE_NAMES = {
        "P": "歩", "L": "香", "N": "桂", "S": "銀", "G": "金", "B": "角", "R": "飛", "K": "玉",
        "+P": "と", "+L": "成香", "+N": "成桂", "+S": "成銀", "+B": "馬", "+R": "龍"
    }

    @staticmethod
    def _rank_to_int(r: str) -> int:
        # USI rank: a..i -> 1..9 （例: f -> 6）
        if not r:
            return 0
        if r.isdigit():
            return int(r)
        o = ord(r.lower()) - ord("a") + 1
        return o if 1 <= o <= 9 else 0

    @staticmethod
    def format_move_label(move: str, turn: str) -> str:
        """
        USI符号（例: 7g7f）を日本語表記（例: ▲7六歩）に変換する
        """
        if not move: return ""
        
        prefix = "▲" if turn == "b" else "△"
        
        # 持ち駒打ち (例: P*7f)
        if "*" in move:
            piece_char, dest = move.split("*", 1)
            piece_name = ShogiUtils.PIECE_NAMES.get(piece_char, piece_char)
            file_idx = int(dest[0])
            rank_idx = ShogiUtils._rank_to_int(dest[1])
            return f"{prefix}{file_idx}{ShogiUtils.KANJI_NUM[rank_idx]}{piece_name}打"
        
        # 通常の指し手 (例: 7g7f, 7g7f+)
        src = move[:2]
        dest = move[2:4]
        promote = "+" in move
        
        file_idx = int(dest[0])
        rank_idx = ShogiUtils._rank_to_int(dest[1])
        
        # ここでは簡易的に「歩」などを決め打ちせず、文脈がないため「指し手」として返す
        # 本来は移動元の駒種が必要だが、簡易版として座標のみ変換する
        # プロンプトで補完させるため、最低限の座標情報を含める
        
        return f"{prefix}{file_idx}{ShogiUtils.KANJI_NUM[rank_idx]}"

class StrategyAnalyzer:
    @staticmethod
    def analyze_sfen(sfen: str) -> str:
        """
        SFEN文字列から戦型を簡易判定する
        """
        if not sfen: return "不明"
        
        # 盤面部分を取得
        board_sfen = sfen.split()[0]
        rows = board_sfen.split("/")
        
        # 簡易判定ロジック (先手番の飛車の位置などで判定)
        # 実際にはより複雑な解析が必要だが、ここではプレースホルダーとして実装
        if "R" in rows[7] or "R" in rows[8]: # 下段に飛車がいる
            return "居飛車"
        elif "R" in rows[4] or "R" in rows[5]: # 中段
            return "中飛車"
            
        return "力戦"
