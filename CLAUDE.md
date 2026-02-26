# Project: 将棋アプリ（解説機能を最優先で開発中）

## Goal (current)
- レッスンは一旦置く
- 解説機能を完成：エンジン解析→重要局面抽出→Geminiで解説JSON生成→表示/保存

## Non-negotiables
- Faithfulness最優先：根拠(PV/評価差/詰み)と矛盾する断言は禁止
- Gemini API Keyはクライアントに置かない（サーバー側のみ）
- 返答はJSONを正としてスキーマで検証し、失敗時フォールバック

## Tech (fill in)
- Web: <<< Next.js? >>>
- Mobile: <<< Expo/React Native? >>>
- Backend: <<< FastAPI/Node? >>>
- Engine: <<< YaneuraOu? >>>
- DB: <<< Prisma/Postgres? >>>

## Commands (fill in)
- install: <<< pnpm i / npm i >>>
- dev: <<< pnpm dev >>>
- test: <<< pnpm test >>>
- lint: <<< pnpm lint >>>

## Env
- GEMINI_API_KEY=...
- GEMINI_MODEL=... (default: lightweight model)
- (optional) ENGINE_PATH=...

## Explanation API Contract (draft)
Input:
- sfen OR (initial + moves)
- moves[]
- user_level? (beginner/intermediate/advanced)
Output (JSON):
- summary[]
- turning_points[]
- mistakes[]
- best_alternatives[]
- evidence{ pv, eval_delta, mate? }

## Coding style
- Small commits, no massive refactor
- Prefer existing patterns in repo
- Add .env.example, never commit secrets