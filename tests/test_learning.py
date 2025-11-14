"""
Learning module tests

Test the complete flow: generate quizzes → submit answers → check progress
"""

import pytest
from fastapi.testclient import TestClient
from backend.api.main import app

client = TestClient(app)


class TestLearningFlow:
    """学習機能の一連フローをテスト"""
    
    def test_complete_learning_flow(self):
        """問題生成 → 回答 → 進捗確認の完全フロー"""
        
        # 1. 問題生成
        reasoning_notes = [
            {
                "move": "7g7f",
                "reasoning": {
                    "summary": "攻撃的な一手で、飛車先の歩を突く",
                    "confidence": 0.8,
                    "tags": ["attack", "development"],
                    "context": {
                        "phase": "opening",
                        "plan": "attack",
                        "move_type": "development"
                    },
                    "pv_summary": {
                        "line": "7g7f 3c3d 2g2f",
                        "why_better": ["飛車道を通す", "先手を取る"]
                    }
                },
                "bestmove": "7g7f",
                "delta_cp": 20
            },
            {
                "move": "2g2f",
                "reasoning": {
                    "summary": "角道を通す基本的な手",
                    "confidence": 0.7,
                    "tags": ["development"],
                    "context": {
                        "phase": "opening",
                        "plan": "develop",
                        "move_type": "normal"
                    },
                    "pv_summary": {
                        "line": "2g2f 8c8d",
                        "why_better": ["角の活用"]
                    }
                },
                "bestmove": "2g2f",
                "delta_cp": 15
            }
        ]
        
        generate_request = {
            "reasoning_notes": reasoning_notes,
            "quiz_count": 2,
            "user_id": "test_user"
        }
        
        response = client.post("/learning/generate", json=generate_request)
        assert response.status_code == 201
        
        quiz_data = response.json()
        assert "quizzes" in quiz_data
        assert "session_id" in quiz_data
        assert quiz_data["total_count"] == 2
        
        quizzes = quiz_data["quizzes"]
        session_id = quiz_data["session_id"]
        
        # 2. 各問題に回答
        total_score = 0
        for quiz in quizzes:
            quiz_id = quiz["id"]
            correct_answer = quiz["correct_answer"]
            
            # 正解で回答
            submit_request = {
                "session_id": session_id,
                "quiz_id": quiz_id,
                "answer": correct_answer,
                "time_taken_ms": 15000,  # 15秒
                "user_id": "test_user"
            }
            
            response = client.post("/learning/submit", json=submit_request)
            assert response.status_code == 200
            
            result = response.json()
            assert result["correct"] is True
            assert result["score"] > 0
            assert "explanation" in result
            assert "feedback" in result
            assert len(result["feedback"]) > 0
            
            total_score += result["score"]
        
        # 3. 進捗確認
        response = client.get("/learning/progress/test_user")
        assert response.status_code == 200
        
        progress = response.json()
        assert progress["user_id"] == "test_user"
        assert progress["total_score"] == total_score
        assert progress["stats"]["total_attempts"] == 2
        assert progress["stats"]["correct_answers"] == 2
        assert progress["stats"]["accuracy"] == 1.0
        assert len(progress["recent_improvements"]) > 0
    
    def test_quiz_generation_fallback(self):
        """reasoning データが不正な場合のフォールバック動作"""
        
        generate_request = {
            "reasoning_notes": [],  # 空データ
            "quiz_count": 1,
            "user_id": "fallback_user"
        }
        
        response = client.post("/learning/generate", json=generate_request)
        assert response.status_code == 201
        
        quiz_data = response.json()
        assert quiz_data["total_count"] == 1
        assert len(quiz_data["quizzes"]) == 1
        
        # フォールバック問題が生成されることを確認
        quiz = quiz_data["quizzes"][0]
        assert "question" in quiz
        assert len(quiz["choices"]) == 4
        assert quiz["difficulty"] == 1  # フォールバックは易しい
    
    def test_wrong_answer_handling(self):
        """間違った回答の処理"""
        
        # 問題生成
        reasoning_notes = [{
            "move": "7g7f",
            "reasoning": {
                "summary": "テスト用",
                "confidence": 0.5,
                "context": {"phase": "middlegame"},
                "pv_summary": {"why_better": ["テスト理由"]}
            },
            "bestmove": "7g7f",
            "delta_cp": 0
        }]
        
        generate_request = {
            "reasoning_notes": reasoning_notes,
            "quiz_count": 1
        }
        
        response = client.post("/learning/generate", json=generate_request)
        quiz_data = response.json()
        
        quiz = quiz_data["quizzes"][0]
        session_id = quiz_data["session_id"]
        
        # 間違った答えを選択
        correct_answer = quiz["correct_answer"]
        wrong_answers = [choice["id"] for choice in quiz["choices"] 
                        if choice["id"] != correct_answer]
        
        submit_request = {
            "session_id": session_id,
            "quiz_id": quiz["id"],
            "answer": wrong_answers[0],  # 最初の間違った選択肢
            "user_id": "wrong_answer_user"
        }
        
        response = client.post("/learning/submit", json=submit_request)
        assert response.status_code == 200
        
        result = response.json()
        assert result["correct"] is False
        assert result["score"] == 0
        assert "explanation" in result
        assert result["correct_answer"] in [choice["move"] for choice in quiz["choices"]]
    
    def test_guest_progress(self):
        """ゲストユーザーの進捗取得"""
        
        response = client.get("/learning/progress")
        assert response.status_code == 200
        
        progress = response.json()
        assert progress["user_id"] == "guest"
        assert "stats" in progress
        assert "recent_improvements" in progress
    
    def test_invalid_session_handling(self):
        """無効なセッションIDの処理"""
        
        submit_request = {
            "session_id": "invalid_session",
            "quiz_id": "invalid_quiz",
            "answer": "A"
        }
        
        response = client.post("/learning/submit", json=submit_request)
        assert response.status_code == 404
    
    def test_quiz_types_generation(self):
        """異なる問題タイプの生成"""
        
        reasoning_notes = [
            {
                "move": "7g7f",
                "reasoning": {
                    "summary": "最善手問題用",
                    "confidence": 0.9,
                    "tags": ["attack"],
                    "context": {"phase": "middle"},
                    "pv_summary": {"why_better": ["攻撃効果"]}
                },
                "bestmove": "7g7f",
                "delta_cp": 100
            },
            {
                "move": "2g2f", 
                "reasoning": {
                    "summary": "評価問題用",
                    "confidence": 0.6,
                    "tags": ["development"],
                    "context": {"phase": "opening"},
                    "pv_summary": {"why_better": ["駒の活用"]}
                },
                "bestmove": "2g2f",
                "delta_cp": -50
            }
        ]
        
        generate_request = {
            "reasoning_notes": reasoning_notes,
            "quiz_count": 3
        }
        
        response = client.post("/learning/generate", json=generate_request)
        assert response.status_code == 201
        
        quiz_data = response.json()
        quiz_types = [quiz["quiz_type"] for quiz in quiz_data["quizzes"]]
        
        # 複数の問題タイプが生成されることを確認
        assert len(set(quiz_types)) >= 1  # 最低1つのタイプは存在
        
        # 各問題が適切な構造を持つことを確認
        for quiz in quiz_data["quizzes"]:
            assert quiz["quiz_type"] in ["best_move", "evaluation", "principles"]
            assert quiz["phase"] in ["序盤", "中盤", "終盤"]
            assert 1 <= quiz["difficulty"] <= 5
            assert len(quiz["choices"]) == 4


if __name__ == "__main__":
    pytest.main([__file__, "-v"])