"""
Pydantic schemas for learning API
"""

from pydantic import BaseModel, Field
from typing import List, Dict, Any, Optional
from enum import Enum


class GamePhase(str, Enum):
    """将棋の局面段階"""
    OPENING = "序盤"
    MIDDLE = "中盤" 
    ENDGAME = "終盤"


class QuizType(str, Enum):
    """問題の種類"""
    BEST_MOVE = "best_move"      # 最善手問題
    EVALUATION = "evaluation"    # 評価問題
    PRINCIPLES = "principles"    # 格言・原則問題


class GenerateQuizRequest(BaseModel):
    """問題生成リクエスト"""
    reasoning_notes: List[Dict[str, Any]] = Field(
        description="AI注釈結果のreasoning出力",
        example=[
            {
                "move": "7g7f",
                "reasoning": {
                    "summary": "攻撃的な一手",
                    "confidence": 0.8,
                    "context": {"phase": "中盤"},
                    "pv_summary": {"why_better": ["角道を通す"]}
                },
                "bestmove": "2g2f",
                "delta_cp": -50
            }
        ]
    )
    quiz_count: int = Field(default=3, ge=1, le=5, description="生成する問題数")
    user_id: Optional[str] = Field(default="guest", description="ユーザーID")


class QuizChoice(BaseModel):
    """選択肢"""
    id: str = Field(description="選択肢ID (A, B, C, D)")
    move: str = Field(description="手の表記 (7g7f等)")
    description: Optional[str] = Field(default=None, description="説明")


class Quiz(BaseModel):
    """クイズ問題"""
    id: str = Field(description="問題ID")
    question: str = Field(description="問題文")
    choices: List[QuizChoice] = Field(description="選択肢")
    correct_answer: str = Field(description="正解の選択肢ID")
    hint: Optional[str] = Field(default=None, description="ヒント")
    phase: GamePhase = Field(description="局面段階")
    quiz_type: QuizType = Field(description="問題種類")
    difficulty: int = Field(ge=1, le=5, description="難易度 (1-5)")
    source_move: str = Field(description="元になった手")


class GenerateQuizResponse(BaseModel):
    """問題生成レスポンス"""
    quizzes: List[Quiz] = Field(description="生成された問題群")
    total_count: int = Field(description="生成数")
    session_id: str = Field(description="セッションID")


class SubmitAnswerRequest(BaseModel):
    """回答提出リクエスト"""
    session_id: str = Field(description="セッションID")
    quiz_id: str = Field(description="問題ID")
    answer: str = Field(description="選択した回答ID")
    time_taken_ms: Optional[int] = Field(default=None, description="回答時間(ms)")
    user_id: Optional[str] = Field(default="guest", description="ユーザーID")


class FeedbackItem(BaseModel):
    """フィードバック項目"""
    category: str = Field(description="カテゴリ (攻め, 守り, 形勢判断等)")
    score: int = Field(ge=0, le=100, description="スコア")
    comment: str = Field(description="コメント")


class SubmitAnswerResponse(BaseModel):
    """回答提出レスポンス"""
    correct: bool = Field(description="正解かどうか")
    score: int = Field(ge=0, le=100, description="獲得スコア")
    explanation: str = Field(description="解説")
    feedback: List[FeedbackItem] = Field(description="詳細フィードバック")
    correct_answer: str = Field(description="正解")


class ProgressStats(BaseModel):
    """進捗統計"""
    total_attempts: int = Field(description="総回答数")
    correct_answers: int = Field(description="正解数")
    accuracy: float = Field(ge=0, le=1, description="正答率")
    average_score: float = Field(ge=0, le=100, description="平均スコア")
    by_phase: Dict[GamePhase, Dict[str, float]] = Field(
        description="局面別統計",
        default_factory=dict
    )
    by_type: Dict[QuizType, Dict[str, float]] = Field(
        description="問題種別統計", 
        default_factory=dict
    )


class ProgressResponse(BaseModel):
    """学習進捗レスポンス"""
    user_id: str = Field(description="ユーザーID")
    total_score: int = Field(description="総スコア")
    level: int = Field(description="レベル")
    stats: ProgressStats = Field(description="詳細統計")
    recent_improvements: List[str] = Field(
        description="最近の改善点",
        default_factory=list
    )