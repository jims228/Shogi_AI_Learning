# check_models.py
import google.generativeai as genai
import os
from dotenv import load_dotenv

# .envファイルを読み込む
load_dotenv()

api_key = os.environ.get("GEMINI_API_KEY")

print("--- Gemini Model Checker ---")
if not api_key:
    print("❌ エラー: GEMINI_API_KEY が環境変数に見つかりません。.envを確認してください。")
else:
    print(f"✅ API Key found: {api_key[:5]}...")
    genai.configure(api_key=api_key)
    
    print("\nあなたのアカウントで利用可能なモデル一覧:")
    try:
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                print(f"- {m.name}")
    except Exception as e:
        print(f"❌ モデル取得中にエラーが発生しました: {e}")