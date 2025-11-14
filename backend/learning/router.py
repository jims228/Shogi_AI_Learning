"""
Learning API Router

AI注釈結果からの学習問題生成、回答評価、進捗管理API
"""

from fastapi import APIRouter, HTTPException, status
from typing import List

from .schemas import (
    GenerateQuizRequest,
    GenerateQuizResponse, 
    SubmitAnswerRequest,
    SubmitAnswerResponse,
    ProgressResponse,
    ProgressStats
)
from .generator import QuizGenerator
from .evaluator import AnswerEvaluator
from .models import storage

router = APIRouter(prefix="/learning", tags=["learning"])

# サービスインスタンス
quiz_generator = QuizGenerator()
answer_evaluator = AnswerEvaluator()


@router.post("/generate", response_model=GenerateQuizResponse, status_code=status.HTTP_201_CREATED)
async def generate_quiz(request: GenerateQuizRequest):
    """
    AI注釈結果からクイズを生成
    
    - **reasoning_notes**: AI注釈結果のreasoning出力
    - **quiz_count**: 生成する問題数 (1-5)
    - **user_id**: ユーザーID (オプション)
    
    Returns:
        GenerateQuizResponse: 生成されたクイズセット
    """
    try:
        # 問題生成
        quizzes = quiz_generator.generate_quizzes(
            request.reasoning_notes, 
            request.quiz_count
        )
        
        if not quizzes:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="問題生成に失敗しました。reasoningデータを確認してください。"
            )
        
        # セッション作成と保存
        session_id = quiz_generator.save_and_create_session(quizzes)
        
        return GenerateQuizResponse(
            quizzes=[quiz.to_schema() for quiz in quizzes],
            total_count=len(quizzes),
            session_id=session_id
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"問題生成中にエラーが発生しました: {str(e)}"
        )


@router.post("/submit", response_model=SubmitAnswerResponse)
async def submit_answer(request: SubmitAnswerRequest):
    """
    クイズの回答を提出して評価を受ける
    
    - **session_id**: クイズセッションID
    - **quiz_id**: 回答する問題ID  
    - **answer**: 選択した回答ID (A, B, C, D)
    - **time_taken_ms**: 回答時間(ミリ秒) - オプション
    - **user_id**: ユーザーID - オプション
    
    Returns:
        SubmitAnswerResponse: 採点結果とフィードバック
    """
    try:
        # セッション検証
        session_quizzes = storage.get_session_quizzes(request.session_id)
        if not session_quizzes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定されたセッションが見つかりません。"
            )
            
        if request.quiz_id not in session_quizzes:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="指定されたセッションにこの問題は含まれていません。"
            )
        
        # 回答評価
        result = answer_evaluator.evaluate_answer(
            session_id=request.session_id,
            quiz_id=request.quiz_id,
            answer=request.answer,
            user_id=request.user_id,
            time_taken_ms=request.time_taken_ms
        )
        
        return result
        
    except HTTPException:
        # 既にHTTPExceptionの場合は再発生
        raise
    except ValueError as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"回答評価中にエラーが発生しました: {str(e)}"
        )


@router.get("/progress/{user_id}", response_model=ProgressResponse)
async def get_progress(user_id: str):
    """
    ユーザーの学習進捗を取得
    
    - **user_id**: 進捗を取得したいユーザーID
    
    Returns:
        ProgressResponse: 学習進捗と統計情報
    """
    try:
        user = storage.get_user(user_id)
        
        # 統計情報を構築
        stats = ProgressStats(
            total_attempts=user.total_attempts,
            correct_answers=user.correct_answers,
            accuracy=user.accuracy,
            average_score=user.average_score,
            by_phase={phase: stats for phase, stats in user.phase_stats.items()},
            by_type={quiz_type: stats for quiz_type, stats in user.type_stats.items()}
        )
        
        # 最近の改善点を生成
        improvements = _generate_improvements(user)
        
        return ProgressResponse(
            user_id=user_id,
            total_score=user.total_score,
            level=user.level,
            stats=stats,
            recent_improvements=improvements
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"進捗取得中にエラーが発生しました: {str(e)}"
        )


@router.get("/progress", response_model=ProgressResponse)
async def get_guest_progress():
    """
    ゲストユーザーの学習進捗を取得
    
    Returns:
        ProgressResponse: ゲストユーザーの学習進捗
    """
    return await get_progress("guest")


def _generate_improvements(user) -> List[str]:
    """最近の改善点を生成"""
    improvements = []
    
    # 正答率ベース
    if user.accuracy >= 0.8:
        improvements.append("高い正答率を維持しています")
    elif user.accuracy >= 0.6:
        improvements.append("正答率が改善しています")
    
    # 局面別特化
    for phase, stats in user.phase_stats.items():
        if stats["attempts"] > 0:
            accuracy = stats["correct"] / stats["attempts"]
            if accuracy >= 0.7:
                improvements.append(f"{phase}の理解が優秀です")
    
    # 問題種別特化  
    for quiz_type, stats in user.type_stats.items():
        if stats["attempts"] > 0:
            accuracy = stats["correct"] / stats["attempts"]
            if accuracy >= 0.8:
                type_name = {
                    "best_move": "最善手問題",
                    "evaluation": "評価問題", 
                    "principles": "格言問題"
                }.get(quiz_type, quiz_type)
                improvements.append(f"{type_name}が得意です")
    
    # フォールバック
    if not improvements:
        if user.total_attempts > 0:
            improvements.append("継続して練習することで成長しています")
        else:
            improvements.append("学習を始めましょう！")
    
    return improvements[:3]  # 最大3項目まで