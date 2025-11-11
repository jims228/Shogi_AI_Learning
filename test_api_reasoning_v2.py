"""
API経由でのreasoning v2機能テストスクリプト
"""

import json
import sys

# Add project root to path
sys.path.insert(0, '/home/jimjace/Shogi_AI_Learning')

from backend.ai.reasoning import build_reasoning


def test_api_reasoning_v2():
    """API形式でのreasoning v2テスト"""
    print("=== API Reasoning v2 Test ===")
    
    # 実際のAPIで使われるような形式のテストデータ
    test_moves = [
        {
            "name": "Opening Development",
            "note": {
                "ply": 3,
                "move": "7g7f",
                "delta_cp": 5,
                "score_before_cp": 0,
                "score_after_cp": 5,
                "bestmove": "7g7f",
                "mate": None,
                "pv": "7g7f 3c3d 2g2f",
                "evidence": {
                    "tactical": {"is_check": False, "is_capture": False},
                    "depth": 12
                },
                "tags": []
            }
        },
        {
            "name": "Tactical Check",
            "note": {
                "ply": 25,
                "move": "8f8e",
                "delta_cp": 120,
                "score_before_cp": -50,
                "score_after_cp": 70,
                "bestmove": "8f8e",
                "mate": None,
                "pv": "8f8e 3a2b 4i3h",
                "evidence": {
                    "tactical": {"is_check": True, "is_capture": False},
                    "depth": 14
                },
                "tags": ["王手"]
            }
        },
        {
            "name": "Blunder",
            "note": {
                "ply": 40,
                "move": "9h9g",
                "delta_cp": -250,
                "score_before_cp": 100,
                "score_after_cp": -150,
                "bestmove": "6g6f",
                "mate": None,
                "pv": "6g6f 2b8h+ 7g7h",
                "evidence": {
                    "tactical": {"is_check": False, "is_capture": False},
                    "depth": 16
                },
                "tags": ["悪手"]
            }
        },
        {
            "name": "Endgame Mate",
            "note": {
                "ply": 85,
                "move": "3a2a",
                "delta_cp": None,
                "score_before_cp": 800,
                "score_after_cp": None,
                "bestmove": "3a2a",
                "mate": 5,
                "pv": "3a2a 1b2a 2b2a+ 1a2a",
                "evidence": {
                    "tactical": {"is_check": False, "is_capture": False},
                    "depth": 20
                },
                "tags": ["終盤"]
            }
        }
    ]
    
    for test_case in test_moves:
        name = test_case["name"]
        note = test_case["note"]
        
        print(f"\n--- {name} ---")
        print(f"Move: {note['move']} (ply {note['ply']})")
        
        # Reasoning生成
        reasoning = build_reasoning(note)
        
        # 結果表示
        print(f"Summary: {reasoning['summary']}")
        print(f"Phase: {reasoning['context']['phase']}")
        print(f"Plan: {reasoning['context']['plan']}")
        print(f"Move Type: {reasoning['context']['move_type']}")
        print(f"Confidence: {reasoning['confidence']:.3f}")
        print(f"Tags: {reasoning['tags']}")
        print(f"Method: {reasoning['method']}")
        
        # PV Summary
        pv_summary = reasoning['pv_summary']
        if pv_summary['line']:
            print(f"PV Line: {pv_summary['line']}")
            print(f"Why Better: {pv_summary['why_better']}")
        
        # スキーマ検証
        required_fields = ["summary", "tags", "confidence", "method", "context", "pv_summary"]
        for field in required_fields:
            if field not in reasoning:
                print(f"❌ Missing field: {field}")
                return False
        
        required_context_fields = ["phase", "plan", "move_type"]
        for field in required_context_fields:
            if field not in reasoning["context"]:
                print(f"❌ Missing context field: {field}")
                return False
        
        # 信頼度範囲チェック
        confidence = reasoning["confidence"]
        if not (0 <= confidence <= 1):
            print(f"❌ Confidence out of range: {confidence}")
            return False
    
    print("\n🎉 All API tests passed! Reasoning v2 is working correctly via API interface.")
    return True


if __name__ == "__main__":
    success = test_api_reasoning_v2()
    sys.exit(0 if success else 1)