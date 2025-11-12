"""
Answer evaluator and feedback generator
"""

import uuid
from typing import Dict, List, Any
from datetime import datetime
from .models import Quiz, Attempt, storage
from .schemas import (
    SubmitAnswerResponse, 
    FeedbackItem, 
    GamePhase, 
    QuizType
)


class AnswerEvaluator:
    """回答採点とフィードバック生成"""
    
    def __init__(self):
        # フィードバックテンプレート
        self.feedback_templates = {
            QuizType.BEST_MOVE: {
                True: [
                    "正解です！最善手を正しく選択できました。",
                    "素晴らしい！局面を正しく判断できました。",
                    "正解！次はより高度な手筋に挑戦しましょう。"
                ],
                False: [
                    "残念！しかし、似たような局面では正しい手筋を覚えておきましょう。",
                    "惜しい！次回はもっと深く考えてみましょう。",
                    "間違いでしたが、理由を理解すれば次は正解できます。"
                ]
            },
            QuizType.EVALUATION: {
                True: [
                    "正觢！手の評価が適切でした。",
                    "良い判断！評価値を正しく読めています。"
                ],
                False: [
                    "評価判断の精度を高めましょう。",
                    "評価値をもっと注意深く見てみましょう。"
                ]
            },
            QuizType.PRINCIPLES: {
                True: [
                    "素晴らしい！将棋の原則をよく理解しています。",
                    "正解！格言を適切に適用できました。"
                ],
                False: [
                    "格言の理解を深めましょう。",
                    "局面と原則の関係をもっと学んでみましょう。"
                ]
            }
        }
    
    def evaluate_answer(
        self, 
        session_id: str,
        quiz_id: str, 
        answer: str, 
        user_id: str = "guest",
        time_taken_ms: int = None
    ) -> SubmitAnswerResponse:
        """回答を評価してフィードバックを生成"""
        
        # クイズ取得
        quiz = storage.get_quiz(quiz_id)
        if not quiz:
            raise ValueError(f"Quiz not found: {quiz_id}")
        
        # 正解判定
        correct = answer == quiz.correct_answer
        
        # スコア計算
        score = self._calculate_score(quiz, correct, time_taken_ms)
        
        # フィードバック生成
        explanation = self._generate_explanation(quiz, correct, answer)
        feedback = self._generate_feedback(quiz, correct, score)
        
        # 回答履歴保存
        attempt = Attempt(
            id=str(uuid.uuid4()),
            user_id=user_id,
            quiz_id=quiz_id,
            session_id=session_id,
            answer=answer,
            correct=correct,
            score=score,
            time_taken_ms=time_taken_ms
        )
        storage.save_attempt(attempt)
        
        # 正解選択肢の手を取得
        correct_choice = next(
            (c for c in quiz.choices if c["id"] == quiz.correct_answer),
            {"move": "不明"}
        )
        
        return SubmitAnswerResponse(
            correct=correct,
            score=score,
            explanation=explanation,
            feedback=feedback,
            correct_answer=correct_choice["move"]
        )
    
    def _calculate_score(self, quiz: Quiz, correct: bool, time_taken_ms: int = None) -> int:
        """スコア計算"""
        if not correct:
            return 0
        
        # 基本スコア
        base_score = 50
        
        # 難易度ボーナス
        difficulty_bonus = quiz.difficulty * 10
        
        # 時間ボーナス（速いほど高スコア）
        time_bonus = 0
        if time_taken_ms:
            if time_taken_ms < 10000:  # 10秒以下
                time_bonus = 20
            elif time_taken_ms < 30000:  # 30秒以下
                time_bonus = 10
            elif time_taken_ms < 60000:  # 60秒以下
                time_bonus = 5
        
        # confidenceボーナス
        confidence = quiz.source_reasoning.get("confidence", 0.5)
        confidence_bonus = int(confidence * 20)  # 最大20ポイント
        
        total_score = min(100, base_score + difficulty_bonus + time_bonus + confidence_bonus)
        return total_score
    
    def _generate_explanation(self, quiz: Quiz, correct: bool, user_answer: str) -> str:
        """解説生成"""
        reasoning = quiz.source_reasoning
        summary = reasoning.get("summary", "手筋を考える局面")
        
        # 正解選択肢の手を取得
        correct_choice = next(
            (c for c in quiz.choices if c["id"] == quiz.correct_answer),
            {"move": "不明"}
        )
        correct_move = correct_choice["move"]
        
        if correct:
            return f"正解です！'{correct_move}' が最適でした。{summary}"
        else:
            # ユーザーの選択を取得
            user_choice = next(
                (c for c in quiz.choices if c["id"] == user_answer),
                {"move": "不明"}
            )
            user_move = user_choice["move"]
            
            # 改善理由を取得
            pv_summary = reasoning.get("pv_summary", {})
            why_better = pv_summary.get("why_better", ["より有効な手筋です"])
            
            explanation = f"選択された '{user_move}' よりも '{correct_move}' が最適です。"
            if why_better:
                explanation += f" 理由: {why_better[0]}"
            
            return explanation
    
    def _generate_feedback(self, quiz: Quiz, correct: bool, score: int) -> List[FeedbackItem]:
        """詳細フィードバック生成"""
        feedback = []
        
        # 基本フィードバック
        quiz_type = quiz.quiz_type
        if quiz_type in self.feedback_templates:
            template = self.feedback_templates[quiz_type][correct]
            comment = template[0] if template else "結果を参考にしてください。"
        else:
            comment = "結果を参考にしてください。"
        
        # メインフィードバック
        feedback.append(FeedbackItem(
            category="総合評価",
            score=score,
            comment=comment
        ))
        
        # 局面別フィードバック
        phase_score = self._calculate_phase_score(quiz.phase, correct)
        phase_comment = self._get_phase_comment(quiz.phase, correct)
        
        feedback.append(FeedbackItem(
            category=f"{quiz.phase}の理解",
            score=phase_score,
            comment=phase_comment
        ))
        
        # 難易度別フィードバック
        difficulty_comment = self._get_difficulty_comment(quiz.difficulty, correct)
        feedback.append(FeedbackItem(
            category="難易度対応",
            score=min(100, score + (quiz.difficulty * 5) if correct else score),
            comment=difficulty_comment
        ))
        
        return feedback
    
    def _calculate_phase_score(self, phase: GamePhase, correct: bool) -> int:
        """局面別スコア計算"""
        base_score = 70 if correct else 30
        
        # 局面難易度調整
        phase_difficulty = {
            GamePhase.OPENING: 1.0,  # 序盤は最も簡単
            GamePhase.MIDDLE: 1.2,   # 中盤はやや難しい
            GamePhase.ENDGAME: 1.5   # 終盤は最も難しい
        }.get(phase, 1.0)
        
        adjusted_score = int(base_score * phase_difficulty)
        return min(100, max(0, adjusted_score))
    
    def _get_phase_comment(self, phase: GamePhase, correct: bool) -> str:
        """局面別コメント"""
        comments = {
            GamePhase.OPENING: {
                True: "序盤の基本をよく理解しています！",
                False: "序盤の基本をもっと学んでみましょう。"
            },
            GamePhase.MIDDLE: {
                True: "中盤の複雑な局面を適切に判断できました！",
                False: "中盤の手筋判断を磨いていきましょう。"
            },
            GamePhase.ENDGAME: {
                True: "終盤力が優秀です！正確な読みができています。",
                False: "終盤の読みを深める練習が必要です。"
            }
        }
        
        return comments.get(phase, {}).get(correct, "継続して練習してください。")
    
    def _get_difficulty_comment(self, difficulty: int, correct: bool) -> str:
        """難易度別コメント"""
        if correct:
            if difficulty >= 4:
                return "難しい問題を見事に正解！素晴らしい力です。"
            elif difficulty >= 3:
                return "標準的な問題を着実に正解しました。"
            else:
                return "基本的な問題を正解！この調子で継続しましょう。"
        else:
            if difficulty >= 4:
                return "難しい問題でした。無理しないで、簡単な問題から始めましょう。"
            elif difficulty >= 3:
                return "もう少し検討してみましょう。似た問題で練習することをおすすめします。"
            else:
                return "基本的な問題です。しっかりと理解して次に進みましょう。"