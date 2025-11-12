"""
Quiz generator from reasoning output
"""

import uuid
import random
from typing import List, Dict, Any, Optional
from .models import Quiz, storage
from .schemas import GamePhase, QuizType


class QuizGenerator:
    """reasoning出力からクイズを生成"""
    
    def __init__(self):
        self.move_options = [
            "7g7f", "2g2f", "8h8f", "6i7h", "5i6h", "3g3f", "4g4f", "1g1f",
            "7i6h", "3i4h", "2h3h", "5g5f", "6g6f", "9g9f", "8g8f",
            "2f2e", "7f7e", "3f3e", "4f4e", "5f5e", "6f6e", "8f8e"
        ]
    
    def generate_quizzes(self, reasoning_notes: List[Dict[str, Any]], count: int = 3) -> List[Quiz]:
        """reasoning出力から複数の問題を生成"""
        quizzes = []
        
        # 有効な注釈データをフィルタ
        valid_notes = [
            note for note in reasoning_notes
            if self._is_valid_note(note)
        ]
        
        if not valid_notes:
            # フォールバック: ダミー問題を生成
            return self._generate_fallback_quizzes(count)
        
        # 問題種類を決定
        quiz_types = self._select_quiz_types(valid_notes, count)
        
        for i, quiz_type in enumerate(quiz_types):
            note = valid_notes[i % len(valid_notes)]
            quiz = self._generate_single_quiz(note, quiz_type)
            if quiz:
                quizzes.append(quiz)
        
        return quizzes
    
    def _is_valid_note(self, note: Dict[str, Any]) -> bool:
        """注釈データの有効性チェック"""
        required_fields = ["move", "reasoning"]
        return all(field in note for field in required_fields)
    
    def _select_quiz_types(self, notes: List[Dict[str, Any]], count: int) -> List[QuizType]:
        """生成する問題種類を選択"""
        types = []
        
        # 最善手問題を優先
        for _ in range(min(count, len(notes))):
            if len(types) < count // 2:
                types.append(QuizType.BEST_MOVE)
            elif len(types) < count:
                types.append(random.choice([QuizType.EVALUATION, QuizType.PRINCIPLES]))
        
        return types
    
    def _generate_single_quiz(self, note: Dict[str, Any], quiz_type: QuizType) -> Optional[Quiz]:
        """単一問題生成"""
        try:
            reasoning = note.get("reasoning", {})
            move = note.get("move", "7g7f")
            bestmove = note.get("bestmove", move)
            
            # 局面判定
            phase = self._determine_phase(reasoning)
            
            # 問題種別ごとの生成
            if quiz_type == QuizType.BEST_MOVE:
                return self._generate_best_move_quiz(note, phase)
            elif quiz_type == QuizType.EVALUATION:
                return self._generate_evaluation_quiz(note, phase)
            elif quiz_type == QuizType.PRINCIPLES:
                return self._generate_principles_quiz(note, phase)
            
        except Exception as e:
            print(f"Quiz generation error: {e}")
            return None
    
    def _generate_best_move_quiz(self, note: Dict[str, Any], phase: GamePhase) -> Quiz:
        """最善手問題生成"""
        move = note.get("move", "7g7f")
        bestmove = note.get("bestmove", move)
        reasoning = note.get("reasoning", {})
        summary = reasoning.get("summary", "手筋を考える局面")
        
        # 選択肢生成（正解 + ダミー3つ）
        choices = []
        correct_move = bestmove
        
        # 正解選択肢
        choices.append({
            "id": "A",
            "move": correct_move,
            "description": "推奨手"
        })
        
        # ダミー選択肢
        dummy_moves = random.sample(
            [m for m in self.move_options if m != correct_move], 3
        )
        for i, dummy_move in enumerate(dummy_moves):
            choices.append({
                "id": chr(66 + i),  # B, C, D
                "move": dummy_move,
                "description": "候補手"
            })
        
        # 選択肢をシャッフル
        random.shuffle(choices)
        correct_answer = next(c["id"] for c in choices if c["move"] == correct_move)
        
        return Quiz(
            id=str(uuid.uuid4()),
            question=f"この局面での最善手はどれですか？\n状況: {summary}",
            choices=choices,
            correct_answer=correct_answer,
            hint=self._generate_hint(reasoning),
            phase=phase,
            quiz_type=QuizType.BEST_MOVE,
            difficulty=self._calculate_difficulty(reasoning),
            source_move=move,
            source_reasoning=reasoning
        )
    
    def _generate_evaluation_quiz(self, note: Dict[str, Any], phase: GamePhase) -> Quiz:
        """評価問題生成"""
        delta_cp = note.get("delta_cp", 0)
        reasoning = note.get("reasoning", {})
        move = note.get("move", "7g7f")
        
        # 評価に基づく選択肢
        if delta_cp >= 100:
            correct = "A"
            evaluation = "良手"
        elif delta_cp >= 0:
            correct = "B" 
            evaluation = "普通"
        elif delta_cp >= -100:
            correct = "C"
            evaluation = "疑問手"
        else:
            correct = "D"
            evaluation = "悪手"
        
        choices = [
            {"id": "A", "move": "良手", "description": "形勢が良くなる"},
            {"id": "B", "move": "普通", "description": "現状維持"},
            {"id": "C", "move": "疑問手", "description": "やや不利"},
            {"id": "D", "move": "悪手", "description": "大きく不利"}
        ]
        
        return Quiz(
            id=str(uuid.uuid4()),
            question=f"手 '{move}' の評価は？",
            choices=choices,
            correct_answer=correct,
            hint=f"評価値変化: {delta_cp:+d}cp",
            phase=phase,
            quiz_type=QuizType.EVALUATION,
            difficulty=self._calculate_difficulty(reasoning),
            source_move=move,
            source_reasoning=reasoning
        )
    
    def _generate_principles_quiz(self, note: Dict[str, Any], phase: GamePhase) -> Quiz:
        """格言・原則問題生成"""
        reasoning = note.get("reasoning", {})
        tags = reasoning.get("tags", [])
        move = note.get("move", "7g7f")
        
        # タグベースの格言選択
        principles = [
            "攻めは飛車角銀桂",
            "玉は包むように寄せよ",
            "大駒は近づけて受けよ",
            "端歩は突くな"
        ]
        
        correct_principle = principles[0]  # デフォルト
        if "attack" in tags or "攻撃" in str(tags):
            correct_principle = "攻めは飛車角銀桂"
        elif "defense" in tags or "守り" in str(tags):
            correct_principle = "大駒は近づけて受けよ"
        
        choices = [
            {"id": "A", "move": correct_principle, "description": "適用原則"},
            {"id": "B", "move": principles[1], "description": "候補原則"},
            {"id": "C", "move": principles[2], "description": "候補原則"},
            {"id": "D", "move": principles[3], "description": "候補原則"}
        ]
        
        return Quiz(
            id=str(uuid.uuid4()),
            question=f"手 '{move}' に関連する将棋の格言は？",
            choices=choices,
            correct_answer="A",
            hint="局面の特徴を考えてみましょう",
            phase=phase,
            quiz_type=QuizType.PRINCIPLES,
            difficulty=self._calculate_difficulty(reasoning),
            source_move=move,
            source_reasoning=reasoning
        )
    
    def _determine_phase(self, reasoning: Dict[str, Any]) -> GamePhase:
        """局面段階判定"""
        context = reasoning.get("context", {})
        phase = context.get("phase", "middlegame")
        
        phase_mapping = {
            "opening": GamePhase.OPENING,
            "middlegame": GamePhase.MIDDLE,
            "endgame": GamePhase.ENDGAME,
            "序盤": GamePhase.OPENING,
            "中盤": GamePhase.MIDDLE,
            "終盤": GamePhase.ENDGAME
        }
        
        return phase_mapping.get(phase, GamePhase.MIDDLE)
    
    def _generate_hint(self, reasoning: Dict[str, Any]) -> str:
        """ヒント生成"""
        pv_summary = reasoning.get("pv_summary", {})
        why_better = pv_summary.get("why_better", [])
        
        if why_better:
            return f"ポイント: {why_better[0]}"
        
        context = reasoning.get("context", {})
        plan = context.get("plan", "develop")
        
        plan_hints = {
            "attack": "攻撃的な手を考えましょう",
            "defense": "守りを固める手を探しましょう", 
            "develop": "駒の活用を重視しましょう",
            "control": "要所の制圧を狙いましょう"
        }
        
        return plan_hints.get(plan, "局面の特徴を分析してみましょう")
    
    def _calculate_difficulty(self, reasoning: Dict[str, Any]) -> int:
        """難易度計算 (1-5)"""
        confidence = reasoning.get("confidence", 0.5)
        
        if confidence >= 0.9:
            return 1  # 簡単
        elif confidence >= 0.7:
            return 2
        elif confidence >= 0.5:
            return 3  # 普通
        elif confidence >= 0.3:
            return 4
        else:
            return 5  # 難しい
    
    def _generate_fallback_quizzes(self, count: int) -> List[Quiz]:
        """フォールバック問題生成"""
        fallback_quizzes = []
        
        for i in range(count):
            quiz = Quiz(
                id=str(uuid.uuid4()),
                question="基本的な序盤の手はどれですか？",
                choices=[
                    {"id": "A", "move": "7g7f", "description": "飛車先の歩"},
                    {"id": "B", "move": "2g2f", "description": "角道を通す"},
                    {"id": "C", "move": "5i6h", "description": "玉を囲う"},
                    {"id": "D", "move": "9g9f", "description": "端歩を突く"}
                ],
                correct_answer="A",
                hint="序盤の基本を思い出しましょう",
                phase=GamePhase.OPENING,
                quiz_type=QuizType.BEST_MOVE,
                difficulty=1,
                source_move="fallback",
                source_reasoning={"summary": "フォールバック問題"}
            )
            fallback_quizzes.append(quiz)
        
        return fallback_quizzes
    
    def save_and_create_session(self, quizzes: List[Quiz]) -> str:
        """問題を保存してセッション作成"""
        quiz_ids = []
        for quiz in quizzes:
            storage.save_quiz(quiz)
            quiz_ids.append(quiz.id)
        
        return storage.create_session(quiz_ids)