"""
reasoning_features.py

エンジン出力から将棋の特徴を抽出するモジュール。
評価値の変化、戦術的要素、盤面情報を分析して構造化データを生成します。
"""

import re
from typing import Dict, List, Any, Optional
from dataclasses import dataclass


@dataclass
class MoveFeatures:
    """一手の特徴を表すデータクラス"""
    # 基本情報
    ply: int
    move: str
    
    # 評価値関連
    delta_cp: Optional[int] = None
    score_before: Optional[int] = None
    score_after: Optional[int] = None
    is_mate_threat: bool = False
    mate_in: Optional[int] = None
    
    # 戦術的特徴
    is_check: bool = False
    is_capture: bool = False
    is_promotion: bool = False
    is_drop: bool = False
    is_castle: bool = False
    
    # 戦略的特徴
    is_attack: bool = False
    is_defense: bool = False
    opens_line: bool = False
    develops_piece: bool = False
    centralizes: bool = False
    
    # 駒の種類
    piece_moved: Optional[str] = None
    piece_captured: Optional[str] = None
    
    # エンジン推奨との比較
    is_best_move: bool = False
    bestmove: Optional[str] = None
    
    # 局面評価
    position_phase: str = "middle"  # opening, middle, endgame
    king_safety_score: Optional[int] = None


def extract_move_features(note: Dict[str, Any]) -> MoveFeatures:
    """
    MoveNote（辞書形式）から特徴を抽出
    
    Args:
        note: APIの MoveNote オブジェクトの辞書表現
        
    Returns:
        MoveFeatures: 抽出された特徴
    """
    features = MoveFeatures(
        ply=note.get("ply", 0),
        move=note.get("move", ""),
        delta_cp=note.get("delta_cp"),
        score_before=note.get("score_before_cp"),
        score_after=note.get("score_after_cp"),
        bestmove=note.get("bestmove"),
    )
    
    # 基本的な戦術特徴を抽出
    _extract_tactical_features(features, note)
    
    # 評価値から戦略的判断
    _extract_strategic_features(features, note)
    
    # 局面フェーズの判定
    _determine_game_phase(features, note)
    
    return features


def _extract_tactical_features(features: MoveFeatures, note: Dict[str, Any]) -> None:
    """戦術的特徴の抽出"""
    move = features.move
    pv = note.get("pv", "")
    
    # 王手の検出
    if "+" in move or (pv and "+" in pv):
        features.is_check = True
    
    # 駒取りの検出（USI形式での判定は限定的）
    evidence = note.get("evidence", {})
    tactical = evidence.get("tactical", {})
    features.is_capture = tactical.get("is_capture", False)
    
    # 成りの検出
    if "+" in move:
        features.is_promotion = True
    
    # 打ち駒の検出（USI形式: 例 P*5e）
    if "*" in move:
        features.is_drop = True
        # 打った駒の種類を取得
        piece_char = move[0].upper()
        features.piece_moved = _usi_piece_to_japanese(piece_char)
    
    # 移動した駒の推定（USI形式から）
    if not features.is_drop:
        features.piece_moved = _extract_piece_from_move(move)
    
    # エンジンの最善手との比較
    if features.bestmove:
        features.is_best_move = (move == features.bestmove)


def _extract_strategic_features(features: MoveFeatures, note: Dict[str, Any]) -> None:
    """戦略的特徴の抽出"""
    delta = features.delta_cp
    move = features.move
    
    # 評価値変化による攻守判定
    if delta is not None:
        if delta > 50:
            features.is_attack = True
        elif delta < -30:
            features.is_defense = True
    
    # 駒の展開判定（序盤での特定の駒の動き）
    if features.ply <= 20:
        piece = features.piece_moved
        if piece in ["銀", "桂", "角", "飛"]:
            features.develops_piece = True
    
    # 中央への利き
    if move and len(move) >= 4:
        dest_file = _extract_destination_file(move)
        if dest_file in [4, 5, 6]:  # 4〜6筋は中央
            features.centralizes = True
    
    # 角道や飛車筋を開ける
    if features.piece_moved == "歩" and features.ply <= 10:
        features.opens_line = True


def _determine_game_phase(features: MoveFeatures, note: Dict[str, Any]) -> None:
    """局面のフェーズ判定"""
    ply = features.ply
    
    if ply <= 24:
        features.position_phase = "opening"
    elif ply >= 80:
        features.position_phase = "endgame"
    else:
        features.position_phase = "middle"


def _usi_piece_to_japanese(usi_char: str) -> str:
    """USI駒文字を日本語に変換"""
    mapping = {
        "P": "歩", "L": "香", "N": "桂", "S": "銀", 
        "G": "金", "B": "角", "R": "飛", "K": "玉"
    }
    return mapping.get(usi_char.upper(), "駒")


def _extract_piece_from_move(move: str) -> str:
    """USI移動から駒の種類を推定（簡易版）"""
    # 実際の実装では盤面状態が必要だが、ここでは一般的なパターンで推定
    if len(move) >= 4:
        # 7g7f のような歩の動きパターン
        from_pos = move[:2]
        to_pos = move[2:4]
        
        # ファイルが同じで1つだけ進んだ場合は歩の可能性が高い
        if from_pos[0] == to_pos[0]:
            try:
                # USI形式では段はa-iなので、英字から数値に変換
                from_rank_char = from_pos[1]
                to_rank_char = to_pos[1]
                from_rank = ord(from_rank_char) - ord('a') + 1
                to_rank = ord(to_rank_char) - ord('a') + 1
                if abs(from_rank - to_rank) == 1:
                    return "歩"
            except (ValueError, IndexError):
                pass
    
    return "駒"  # 不明な場合


def _extract_destination_file(move: str) -> int:
    """移動先の筋を取得"""
    if len(move) >= 4:
        try:
            # USI形式: 7g7f の場合、移動先は7f
            dest_file_char = move[2]
            if dest_file_char.isdigit():
                return int(dest_file_char)
        except (ValueError, IndexError):
            pass
    return 5  # デフォルトは中央


def analyze_position_features(moves: List[str], scores: List[Optional[int]]) -> Dict[str, Any]:
    """
    全体的な局面特徴の分析
    
    Args:
        moves: 全ての指し手リスト
        scores: 各局面の評価値リスト
        
    Returns:
        Dict: 全体特徴の分析結果
    """
    features = {
        "total_moves": len(moves),
        "score_swings": 0,
        "lead_changes": 0,
        "avg_score": None,
        "max_advantage": None,
        "critical_moments": [],
        "game_balance": "balanced",
    }
    
    # 数値スコアのみ抽出
    numeric_scores = [s for s in scores if s is not None]
    
    if numeric_scores:
        features["avg_score"] = sum(numeric_scores) // len(numeric_scores)
        features["max_advantage"] = max(abs(s) for s in numeric_scores)
        
        # ゲームバランスの判定
        max_abs = max(abs(s) for s in numeric_scores)
        if max_abs > 500:
            features["game_balance"] = "decisive"
        elif max_abs > 200:
            features["game_balance"] = "advantage"
    
    # 評価値の大きな変動を検出
    for i in range(1, len(numeric_scores)):
        diff = abs(numeric_scores[i] - numeric_scores[i-1])
        if diff > 120:
            features["score_swings"] += 1
    
    # リードチェンジの検出
    for i in range(1, len(numeric_scores)):
        prev_sign = 1 if numeric_scores[i-1] > 0 else -1 if numeric_scores[i-1] < 0 else 0
        curr_sign = 1 if numeric_scores[i] > 0 else -1 if numeric_scores[i] < 0 else 0
        if prev_sign != 0 and curr_sign != 0 and prev_sign != curr_sign:
            features["lead_changes"] += 1
    
    return features


def classify_move_strength(delta_cp: Optional[int]) -> str:
    """評価値変化から手の強さを分類"""
    if delta_cp is None:
        return "不明"
    
    if delta_cp >= 200:
        return "絶好手"
    elif delta_cp >= 120:
        return "好手"
    elif delta_cp >= 30:
        return "良手"
    elif delta_cp >= -30:
        return "通常手"
    elif delta_cp >= -80:
        return "疑問手"
    elif delta_cp >= -150:
        return "悪手"
    else:
        return "大悪手"


def detect_phase(note: Dict[str, Any]) -> Dict[str, str]:
    """
    局面のフェーズと手番を検出
    
    Args:
        note: MoveNote辞書
        
    Returns:
        Dict: {"phase": "opening|middlegame|endgame", "turn": "sente|gote"}
    """
    ply = note.get("ply", 1)
    score_cp = note.get("score_after_cp") or note.get("score_cp")
    mate = note.get("mate")
    evidence = note.get("evidence", {})
    
    # 手番判定（奇数手=先手、偶数手=後手）
    turn = "sente" if ply % 2 == 1 else "gote"
    
    # 終盤判定
    if mate is not None:
        phase = "endgame"
    elif score_cp is not None and abs(score_cp) >= 1500:
        phase = "endgame"
    elif ply >= 80:
        phase = "endgame"
    # 序盤判定
    elif ply <= 40:
        # 駒交換や大きな評価値変動、戦術的要素が少ない場合は序盤
        tactical = evidence.get("tactical", {})
        is_tactical_move = (
            tactical.get("is_capture", False) or 
            tactical.get("is_check", False) or 
            (score_cp is not None and abs(score_cp) >= 300)
        )
        
        if is_tactical_move:
            phase = "middlegame"
        else:
            phase = "opening"
    else:
        phase = "middlegame"
    
    return {"phase": phase, "turn": turn}


def classify_plan(note: Dict[str, Any]) -> Dict[str, str]:
    """
    手の戦略的計画を分類
    
    Args:
        note: MoveNote辞書
        
    Returns:
        Dict: {"plan": "develop|attack|defend|trade|castle|promotion|endgame-technique"}
    """
    ply = note.get("ply", 1)
    delta_cp = note.get("delta_cp", 0)
    evidence = note.get("evidence", {})
    tactical = evidence.get("tactical", {})
    tags = note.get("tags", [])
    move = note.get("move", "")
    
    # 終盤技術
    if ply >= 80 or note.get("mate") is not None:
        return {"plan": "endgame-technique"}
    
    # 成り
    if "+" in move or "成り" in tags:
        return {"plan": "promotion"}
    
    # 玉の移動（囲い）
    if _is_king_move(move) and ply <= 30:
        return {"plan": "castle"}
    
    # 駒交換
    if tactical.get("is_capture", False):
        return {"plan": "trade"}
    
    # 攻め（王手、大きな評価値向上）
    if tactical.get("is_check", False) or (delta_cp and delta_cp > 80):
        return {"plan": "attack"}
    
    # 守り（評価値悪化防止、王の安全）
    if delta_cp and delta_cp < -50:
        return {"plan": "defend"}
    
    # 駒組み（序盤）
    if ply <= 30:
        return {"plan": "develop"}
    
    return {"plan": "develop"}


def classify_move(note: Dict[str, Any]) -> Dict[str, str]:
    """
    手のタイプを分類
    
    Args:
        note: MoveNote辞書
        
    Returns:
        Dict: {"move_type": "normal|check|capture|promote|sacrifice|quiet-improve|blunder-flag"}
    """
    delta_cp = note.get("delta_cp", 0)
    evidence = note.get("evidence", {})
    tactical = evidence.get("tactical", {})
    move = note.get("move", "")
    pv = note.get("pv", "")
    depth = evidence.get("depth", 0)
    
    # 大悪手フラグ
    if delta_cp is not None and delta_cp <= -200 and depth >= 8:
        return {"move_type": "blunder-flag"}
    
    # 犠牲手（評価値一時的悪化だが戦術的補償あり）
    if delta_cp is not None and delta_cp < -100:
        # PVで後続手順をチェック（簡易版）
        if pv and ("+" in pv or len(pv.split()) >= 3):
            # 戦術的補償の可能性あり
            return {"move_type": "sacrifice"}
    
    # 成り
    if "+" in move:
        return {"move_type": "promote"}
    
    # 王手
    if tactical.get("is_check", False):
        return {"move_type": "check"}
    
    # 駒取り
    if tactical.get("is_capture", False):
        return {"move_type": "capture"}
    
    # 静かな改善手
    if delta_cp is not None and 30 <= delta_cp <= 100:
        return {"move_type": "quiet-improve"}
    
    return {"move_type": "normal"}


def analyze_pv_comparison(note: Dict[str, Any]) -> Dict[str, Any]:
    """
    PVと最善手の比較分析
    
    Args:
        note: MoveNote辞書
        
    Returns:
        Dict: PV比較の要約
    """
    pv = note.get("pv", "")
    bestmove = note.get("bestmove")
    move = note.get("move", "")
    delta_cp = note.get("delta_cp", 0)
    
    pv_summary = {
        "line": pv[:50] + "..." if len(pv) > 50 else pv,
        "why_better": []
    }
    
    if not bestmove or move == bestmove:
        pv_summary["why_better"] = ["最善手です"]
        return pv_summary
    
    # 最善手との差異を分析
    if delta_cp is not None:
        if delta_cp <= -100:
            pv_summary["why_better"].append(f"評価値が{abs(delta_cp)}cp改善される")
        
        if "+" in pv and "+" not in move:
            pv_summary["why_better"].append("王手による攻撃機会")
        
        if len(pv.split()) >= 4:
            pv_summary["why_better"].append("より長期的な構想")
    
    if not pv_summary["why_better"]:
        pv_summary["why_better"] = ["エンジン推奨の手順"]
    
    return pv_summary


def compute_confidence(note: Dict[str, Any]) -> float:
    """
    推論の信頼度を計算
    
    Args:
        note: MoveNote辞書
        
    Returns:
        float: 0-1の信頼度
    """
    import math
    import os
    
    # depth情報
    evidence = note.get("evidence", {})
    depth = evidence.get("depth", 6)
    
    # 評価値の安定性
    delta_cp = note.get("delta_cp", 0)
    abs_delta = abs(delta_cp) if delta_cp is not None else 0
    
    # sigmoid関数
    def sigmoid(x):
        return 1 / (1 + math.exp(-x))
    
    # 基本信頼度（探索深度ベース）
    base = sigmoid((depth - 6) / 4)
    
    # 安定性（評価値変化の明確さ）
    stability = sigmoid(abs_delta / 200)
    
    # LLMボーナス
    llm_bonus = 0.1 if os.getenv("USE_LLM", "0") == "1" else 0
    
    # 最終計算
    confidence = 0.5 * base + 0.4 * stability + llm_bonus
    
    # 0-1にクランプ
    return max(0.0, min(1.0, confidence))


def _is_king_move(move: str) -> bool:
    """玉の移動かどうか判定（簡易版）"""
    # USI形式では盤面状態が必要だが、ここでは5筋周辺の動きで推定
    if len(move) >= 4:
        from_file = move[0]
        to_file = move[2]
        # 5筋周辺の動き（4,5,6筋）
        return from_file in "456" and to_file in "456"
    return False


def extract_tags_from_features(features: MoveFeatures) -> List[str]:
    """特徴からタグを生成"""
    tags = []
    
    # 評価値ベース
    if features.delta_cp is not None:
        strength = classify_move_strength(features.delta_cp)
        if strength != "通常手":
            tags.append(strength)
    
    # 戦術的特徴
    if features.is_check:
        tags.append("王手")
    if features.is_capture:
        tags.append("駒取り")
    if features.is_promotion:
        tags.append("成り")
    if features.is_drop:
        tags.append("打ち駒")
    if features.is_castle:
        tags.append("囲い")
    
    # 戦略的特徴
    if features.is_attack:
        tags.append("攻め")
    if features.is_defense:
        tags.append("守り")
    if features.opens_line:
        tags.append("筋を開ける")
    if features.develops_piece:
        tags.append("駒組み")
    if features.centralizes:
        tags.append("中央制圧")
    
    # エンジンとの比較
    if not features.is_best_move and features.bestmove:
        tags.append("次善手")
    
    # 局面フェーズ
    if features.position_phase == "opening":
        tags.append("序盤")
    elif features.position_phase == "endgame":
        tags.append("終盤")
    
    return tags