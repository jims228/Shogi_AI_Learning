"""
Learning Module

AI注釈結果から自動生成される練習問題の学習システム。
reasoning出力を活用して問題生成・採点・進捗管理を行う。
"""

__version__ = "0.1.0"
__author__ = "Shogi AI Learning Team"

from .generator import QuizGenerator
from .evaluator import AnswerEvaluator
from .models import UserProgress, Quiz, Attempt
from .schemas import (
    GenerateQuizRequest,
    GenerateQuizResponse, 
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    ProgressResponse
)

__all__ = [
    "QuizGenerator",
    "AnswerEvaluator",
    "UserProgress",
    "Quiz", 
    "Attempt",
    "GenerateQuizRequest",
    "GenerateQuizResponse",
    "SubmitAnswerRequest",
    "SubmitAnswerResponse",
    "ProgressResponse"
]