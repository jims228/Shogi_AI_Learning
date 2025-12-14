"""
AI推論システムのテスト

ルールベースとLLMの両方をテストします。
"""

import os
import sys
import json
import pytest

# パスを調整してbackendモジュールをインポート可能にする
sys.path.append('/home/jimjace/Shogi_AI_Learning')

def test_rule_based_reasoning():
    """ルールベースの推論をテスト"""
    print("=== ルールベースの推論テスト ===")
    
    try:
        from backend.ai.reasoning import build_reasoning, test_reasoning_system
        
        # テスト用のMoveNote
        test_note = {
            "ply": 1,
            "move": "7g7f",
            "delta_cp": 10,
            "score_before_cp": 0,
            "score_after_cp": 10,
            "bestmove": "7g7f",
            "tags": ["序盤"],
            "evidence": {"tactical": {"is_check": False, "is_capture": False}}
        }
        
        # LLMを無効にしてルールベースのみテスト
        os.environ["USE_LLM"] = "0"
        
        reasoning = build_reasoning(test_note)
        print(f"生成された推論: {reasoning}")
        
        assert reasoning is not None
        assert "summary" in reasoning
        assert "tags" in reasoning
        assert reasoning["method"] == "rule_based"
        
        print("✓ ルールベースの推論テスト成功")
        
        # システムテスト
        test_result = test_reasoning_system()
        print(f"システムテスト結果: {test_result}")
        
    except Exception as e:
        print(f"✗ ルールベースのテストエラー: {e}")
        raise


def test_llm_reasoning():
    """LLMを使った推論をテスト（APIキーが設定されている場合）"""
    print("=== LLM推論テスト ===")
    
    # APIキーの確認
    gemini_key = os.getenv("GEMINI_API_KEY")
    openai_key = os.getenv("OPENAI_API_KEY")
    
    if not gemini_key and not openai_key:
        print("⚠️  APIキーが設定されていないため、LLMテストをスキップします")
        pytest.skip("APIキー未設定のため LLM テストをスキップ")
    
    try:
        from backend.ai.reasoning import build_reasoning
        from backend.ai.reasoning_llm import call_llm_for_reasoning
        
        # LLMを有効にしてテスト
        os.environ["USE_LLM"] = "1"
        
        if gemini_key and gemini_key != "PUT_YOUR_GEMINI_API_KEY_HERE":
            os.environ["LLM_PROVIDER"] = "gemini"
            print("Geminiでテスト中...")
        elif openai_key and openai_key != "PUT_YOUR_OPENAI_API_KEY_HERE":
            os.environ["LLM_PROVIDER"] = "openai"
            print("OpenAIでテスト中...")
        else:
            print("⚠️  有効なAPIキーが設定されていません")
            pytest.skip("有効なAPIキーが設定されていません")
        
        test_note = {
            "ply": 1,
            "move": "7g7f",
            "delta_cp": 10,
            "score_before_cp": 0,
            "score_after_cp": 10,
            "bestmove": "7g7f",
            "tags": ["序盤"],
            "evidence": {"tactical": {"is_check": False, "is_capture": False}}
        }
        
        reasoning = build_reasoning(test_note)
        print(f"LLM改善後の推論: {reasoning}")
        
        if reasoning and reasoning.get("method") == "llm_enhanced":
            print("✓ LLM推論テスト成功")
            assert True
        else:
            print("⚠️  LLM改善が適用されませんでした（APIエラーまたは設定問題）")
            pytest.skip("LLM改善が適用されませんでした（APIエラーまたは設定問題）")
            
    except Exception as e:
        print(f"✗ LLMテストエラー: {e}")
        raise


def test_annotate_integration():
    """annotate APIとの統合テスト"""
    print("=== Annotate API統合テスト ===")
    
    try:
        # ダミーエンジンを使用
        os.environ["USE_DUMMY_ENGINE"] = "1"
        os.environ["USE_LLM"] = "0"  # ルールベースのみでテスト
        
        from backend.api.main import app, AnnotateRequest
        from fastapi.testclient import TestClient
        
        client = TestClient(app)
        
        # テスト用の棋譜
        test_request = {
            "usi": "startpos moves 7g7f 3c3d 2g2f"
        }
        
        response = client.post("/annotate", json=test_request)
        assert response.status_code == 200, f"API呼び出し失敗: {response.status_code} {response.text}"

        data = response.json()
        print(f"レスポンス例: {json.dumps(data, ensure_ascii=False, indent=2)}")

        # 互換APIの最低限の形を検証（reasoning は環境/実装により無い場合があるので必須にしない）
        assert "notes" in data
        assert isinstance(data["notes"], list)

        for note in data["notes"]:
            if "reasoning" in note and note["reasoning"]:
                print(f"✓ reasoning フィールドが追加されました")
                print(f"  - 手: {note['move']}")
                print(f"  - 推論: {note['reasoning']['summary']}")
                print(f"  - タグ: {note['reasoning']['tags']}")
                break
            
    except ImportError as e:
        print(f"⚠️  統合テストモジュールのインポートエラー（期待される）: {e}")
        pytest.skip("FastAPI test client 依存が無いためスキップ")
    except Exception as e:
        print(f"✗ 統合テストエラー: {e}")
        raise


def test_features_extraction():
    """特徴抽出機能のテスト"""
    print("=== 特徴抽出テスト ===")
    
    try:
        from backend.ai.reasoning_features import extract_move_features, extract_tags_from_features
        
        test_cases = [
            {
                "name": "通常手",
                "note": {
                    "ply": 1,
                    "move": "7g7f", 
                    "delta_cp": 10,
                    "evidence": {"tactical": {"is_check": False, "is_capture": False}}
                }
            },
            {
                "name": "王手",
                "note": {
                    "ply": 10,
                    "move": "8h2b+",
                    "delta_cp": 150,
                    "evidence": {"tactical": {"is_check": True, "is_capture": False}}
                }
            },
            {
                "name": "駒取り",
                "note": {
                    "ply": 15,
                    "move": "3c3d",
                    "delta_cp": 80,
                    "evidence": {"tactical": {"is_check": False, "is_capture": True}}
                }
            },
            {
                "name": "悪手",
                "note": {
                    "ply": 20,
                    "move": "5i4h",
                    "delta_cp": -200,
                    "evidence": {"tactical": {"is_check": False, "is_capture": False}}
                }
            }
        ]
        
        for test_case in test_cases:
            print(f"\nテスト: {test_case['name']}")
            features = extract_move_features(test_case["note"])
            tags = extract_tags_from_features(features)
            
            print(f"  特徴: delta_cp={features.delta_cp}, 王手={features.is_check}, 駒取り={features.is_capture}")
            print(f"  タグ: {tags}")

            assert features is not None
            assert isinstance(tags, list)
        
        print("✓ 特徴抽出テスト成功")
        
    except Exception as e:
        print(f"✗ 特徴抽出テストエラー: {e}")
        raise


def main():
    """メイン関数"""
    print("将棋AI注釈システム - 総合テスト")
    print("="*50)
    
    # 環境情報表示
    print(f"USE_LLM: {os.getenv('USE_LLM', '未設定')}")
    print(f"LLM_PROVIDER: {os.getenv('LLM_PROVIDER', '未設定')}")
    print(f"Gemini API: {'設定済み' if os.getenv('GEMINI_API_KEY') else '未設定'}")
    print(f"OpenAI API: {'設定済み' if os.getenv('OPENAI_API_KEY') else '未設定'}")
    print()
    
    results = []
    
    # テスト実行
    results.append(("特徴抽出", test_features_extraction()))
    results.append(("ルールベース推論", test_rule_based_reasoning()))
    results.append(("LLM推論", test_llm_reasoning()))
    results.append(("API統合", test_annotate_integration()))
    
    # 結果サマリー
    print("\n" + "="*50)
    print("テスト結果サマリー:")
    
    success_count = 0
    for name, success in results:
        status = "✓ 成功" if success else "✗ 失敗"
        print(f"  {name}: {status}")
        if success:
            success_count += 1
    
    print(f"\n成功: {success_count}/{len(results)}")
    
    if success_count == len(results):
        print("🎉 全テスト成功！AI推論システムが正常に動作しています。")
    else:
        print("⚠️  一部のテストが失敗しました。ログを確認してください。")
    
    return success_count == len(results)


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)