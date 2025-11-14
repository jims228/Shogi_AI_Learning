"""
Data models for learning system (in-memory implementation)
"""

import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from .schemas import GamePhase, QuizType, Quiz as QuizSchema


@dataclass
class UserProgress:
    """ユーザー学習進捗"""
    user_id: str
    total_score: int = 0
    level: int = 1
    created_at: datetime = field(default_factory=datetime.now)
    updated_at: datetime = field(default_factory=datetime.now)
    
    # 統計情報
    total_attempts: int = 0
    correct_answers: int = 0
    phase_stats: Dict[GamePhase, Dict[str, Any]] = field(default_factory=dict)
    type_stats: Dict[QuizType, Dict[str, Any]] = field(default_factory=dict)
    
    def add_attempt(self, quiz_type: QuizType, phase: GamePhase, correct: bool, score: int):
        """回答試行を記録"""
        self.total_attempts += 1
        if correct:
            self.correct_answers += 1
        self.total_score += score
        
        # レベル計算（100点毎にレベルアップ）
        self.level = max(1, self.total_score // 100 + 1)
        
        # 局面別統計
        if phase not in self.phase_stats:
            self.phase_stats[phase] = {"attempts": 0, "correct": 0, "total_score": 0}
        self.phase_stats[phase]["attempts"] += 1
        if correct:
            self.phase_stats[phase]["correct"] += 1
        self.phase_stats[phase]["total_score"] += score
        
        # 問題種別統計
        if quiz_type not in self.type_stats:
            self.type_stats[quiz_type] = {"attempts": 0, "correct": 0, "total_score": 0}
        self.type_stats[quiz_type]["attempts"] += 1
        if correct:
            self.type_stats[quiz_type]["correct"] += 1
        self.type_stats[quiz_type]["total_score"] += score
        
        self.updated_at = datetime.now()
    
    @property
    def accuracy(self) -> float:
        """正答率"""
        return self.correct_answers / self.total_attempts if self.total_attempts > 0 else 0.0
    
    @property
    def average_score(self) -> float:
        """平均スコア"""
        return self.total_score / self.total_attempts if self.total_attempts > 0 else 0.0


@dataclass
class Quiz:
    """クイズ問題（内部用）"""
    id: str
    question: str
    choices: List[Dict[str, str]]  # {"id": "A", "move": "7g7f", "description": "..."}
    correct_answer: str
    hint: Optional[str]
    phase: GamePhase
    quiz_type: QuizType
    difficulty: int
    source_move: str
    source_reasoning: Dict[str, Any]
    created_at: datetime = field(default_factory=datetime.now)
    
    def to_schema(self) -> QuizSchema:
        """Pydanticスキーマに変換"""
        from .schemas import QuizChoice
        return QuizSchema(
            id=self.id,
            question=self.question,
            choices=[QuizChoice(**choice) for choice in self.choices],
            correct_answer=self.correct_answer,
            hint=self.hint,
            phase=self.phase,
            quiz_type=self.quiz_type,
            difficulty=self.difficulty,
            source_move=self.source_move
        )


@dataclass
class Attempt:
    """回答履歴"""
    id: str
    user_id: str
    quiz_id: str
    session_id: str
    answer: str
    correct: bool
    score: int
    time_taken_ms: Optional[int]
    created_at: datetime = field(default_factory=datetime.now)


class InMemoryStorage:
    """インメモリストレージ（MVP用）"""
    
    def __init__(self):
        self.users: Dict[str, UserProgress] = {}
        self.quizzes: Dict[str, Quiz] = {}
        self.attempts: Dict[str, Attempt] = {}
        self.sessions: Dict[str, List[str]] = {}  # session_id -> [quiz_ids]
    
    def get_user(self, user_id: str) -> UserProgress:
        """ユーザー進捗取得"""
        if user_id not in self.users:
            self.users[user_id] = UserProgress(user_id=user_id)
        return self.users[user_id]
    
    def save_quiz(self, quiz: Quiz) -> None:
        """クイズ保存"""
        self.quizzes[quiz.id] = quiz
    
    def get_quiz(self, quiz_id: str) -> Optional[Quiz]:
        """クイズ取得"""
        return self.quizzes.get(quiz_id)
    
    def save_attempt(self, attempt: Attempt) -> None:
        """回答履歴保存"""
        self.attempts[attempt.id] = attempt
        
        # ユーザー進捗更新
        user = self.get_user(attempt.user_id)
        quiz = self.get_quiz(attempt.quiz_id)
        if quiz:
            user.add_attempt(quiz.quiz_type, quiz.phase, attempt.correct, attempt.score)
    
    def create_session(self, quiz_ids: List[str]) -> str:
        """セッション作成"""
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = quiz_ids
        return session_id
    
    def get_session_quizzes(self, session_id: str) -> List[str]:
        """セッションのクイズID一覧取得"""
        return self.sessions.get(session_id, [])


# グローバルストレージインスタンス（MVP用）
storage = InMemoryStorage()