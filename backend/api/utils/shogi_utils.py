import re

KANJI_NUM = {1: "一", 2: "二", 3: "三", 4: "四", 5: "五", 6: "六", 7: "七", 8: "八", 9: "九"}
PIECE_MAP = {
    "P": "歩", "L": "香", "N": "桂", "S": "銀", "G": "金", "B": "角", "R": "飛",
    "+P": "と", "+L": "成香", "+N": "成桂", "+S": "成銀", "+B": "馬", "+R": "龍",
    "K": "玉", "G": "金" # Gote King is usually k, but handled by case
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
    
    # 打ち手の場合 (例: P*2c)
    if "*" in move:
        piece_char, dest = move.split("*")
        file_char = dest[0]
        rank_char = dest[1]
        
        # 持ち駒打ち (例: P*7f)
        if "*" in move:
            piece_char, dest = move.split("*", 1)
            piece_name = ShogiUtils.PIECE_NAMES.get(piece_char, piece_char)
            file_idx = int(dest[0])
            rank_idx = ShogiUtils._rank_to_int(dest[1])
            return f"{prefix}{file_idx}{ShogiUtils.KANJI_NUM[rank_idx]}{piece_name}打"
        
        piece_name = PIECE_MAP.get(piece_char, "")
        
        file_idx = int(dest[0])
        rank_idx = ShogiUtils._rank_to_int(dest[1])
        
        dst_rank_num = {"a": 1, "b": 2, "c": 3, "d": 4, "e": 5, "f": 6, "g": 7, "h": 8, "i": 9}.get(dst_rank, 0)
        dst_rank_kanji = KANJI_NUM.get(dst_rank_num, "")
        
        promote_str = "成" if promote else ""
        
        # 盤面情報がないので駒名は不明。座標のみ表示し、元のUSIを付記する
        return f"{prefix}{dst_file}{dst_rank_kanji}{promote_str}({src_file}{src_rank})"
        
    return move

class StrategyAnalyzer:
    def __init__(self, sfen: str):
        self.sfen = sfen
        self.board = self._parse_sfen(sfen)
        
    def _parse_sfen(self, sfen: str):
        try:
            # sfen ... w ...
            if not sfen or "startpos" in sfen:
                # 空またはstartposの場合は初期配置を返す
                sfen = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
                
            parts = sfen.split(" ")
            if len(parts) < 1:
                 # フォーマット不正の場合も初期配置
                 sfen = "lnsgkgsnl/1r5b1/ppppppppp/9/9/9/PPPPPPPPP/1B5R1/LNSGKGSNL b - 1"
                 parts = sfen.split(" ")
    
            board_str = parts[0]
            rows = board_str.split("/")
            if len(rows) != 9:
                raise ValueError("Invalid board rows")

            board = []
            for row in rows:
                current_row = []
                for char in row:
                    if char.isdigit():
                        current_row.extend([""] * int(char))
                    else:
                        current_row.append(char)
                if len(current_row) != 9:
                     # 行の長さが不正な場合、補正するかエラーにする
                     # ここでは簡易的に空文字で埋める
                     while len(current_row) < 9: current_row.append("")
                     current_row = current_row[:9]
                board.append(current_row)
            return board
        except Exception:
            # パース失敗時は空の盤面(9x9)を返して落ちないようにする
            return [["" for _ in range(9)] for _ in range(9)]

    def analyze(self) -> str:
        """
        戦型を簡易判定する
        """
        try:
            if not self.board or len(self.board) != 9:
                return "不明"

            # 飛車の位置を探す (先手: R, 後手: r)
            sente_rook_col = -1
            gote_rook_col = -1
            
            for r in range(9):
                for c in range(9):
                    piece = self.board[r][c]
                    if piece == "R" or piece == "+R":
                        sente_rook_col = 9 - c # 筋は右から1, 2...
                    elif piece == "r" or piece == "+r":
                        gote_rook_col = 9 - c
    
            # 玉の位置を探す (先手: K, 後手: k)
            sente_king_col = -1
            gote_king_col = -1
            
            for r in range(9):
                for c in range(9):
                    piece = self.board[r][c]
                    if piece == "K":
                        sente_king_col = 9 - c
                    elif piece == "k":
                        gote_king_col = 9 - c
    
            sente_strategy = self._judge_rook_strategy(sente_rook_col)
            gote_strategy = self._judge_rook_strategy(gote_rook_col)
            
            sente_castle = self._judge_castle(sente_king_col)
            gote_castle = self._judge_castle(gote_king_col)
            
            return f"先手: {sente_strategy}（{sente_castle}） vs 後手: {gote_strategy}（{gote_castle}）"
        except Exception:
            return "不明"

    def _judge_rook_strategy(self, col: int) -> str:
        if col == -1: return "不明"
        if col in [2, 8]: return "居飛車"
        if col == 5: return "中飛車"
        if col in [3, 4, 6, 7]: return "振り飛車"
        return "その他"

    def _judge_castle(self, col: int) -> str:
        if col == -1: return "不明"
        if col in [1, 9]: return "穴熊模様"
        if col in [2, 8]: return "美濃模様"
        if col in [3, 7]: return "矢倉模様"
        if col in [4, 6]: return "右玉模様"
        if col == 5: return "中住まい"
        return "その他"
