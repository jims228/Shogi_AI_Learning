目的
- ユーザーが持つ対局データ（KIF / CSA / USI）をブラウザ側で受け取り、USI 形式（startpos moves ...）へ自動正規化して、既存の /annotate と /digest ワークフローへ繋げられるようにする。
- 開発環境で実エンジンが無くても動かせるようにダミーエンジン切替を追加し、ローカル検証を容易にする。
目的
- ユーザーが持つ対局データ（KIF / CSA / USI）をブラウザ側で受け取り、USI 形式（startpos moves ...）へ自動正規化して、既存の /annotate と /digest ワークフローへ繋げられるようにする。
- 開発環境で実エンジンが無くても動かせるようにダミーエンジン切替を追加し、ローカル検証を容易にする。

変更要約（Why / What / How / Impact）
- Why: ユーザーが持つ多様な棋譜形式を手動で変換せずにそのまま注釈パイプラインへ流すため。ローカル開発時の検証負荷を下げるためダミーエンジンも用意しました。
- What: フロントに ingest ユーティリティ（KIF/CSA/USI → startpos USI）、AnnotateView のファイル読込・ドラッグ＆ドロップ・貼り付け解析、複数局選択ダイアログ、および簡易テストを追加。バックエンドは環境変数で DummyUSIEngine を切替可能にしました。
- How: `apps/web/src/lib/ingest.ts` に正規化ロジックを実装し、`apps/web/src/components/AnnotateView.tsx` に UI とハンドラを追加。`backend/api/main.py` は `USE_DUMMY_ENGINE=1` によりダミーエンジンを使用する実行パスを追加しています。
- Impact: 既存の /annotate /digest の呼び出し方法は変更せず後方互換を維持します。フロントでの入力が自動的に USI に正規化されるため UX が向上します。CI に Web CI を追加したため、`apps/web/**` の変更で型・リンタ・テスト・ビルドが自動的に走るようになります。

互換性と環境変数の注意
- 後方互換性: 本 PR は破壊的変更を行いません。既存 API のエンドポイントやフロントの公開インターフェースに対する破壊的変更はありません。
- 環境変数:
  - `USE_DUMMY_ENGINE=1` — バックエンドで DummyUSIEngine を利用（ローカル開発向け）。実エンジンに切り替える場合はこの環境変数を `0` にしてください。
  - `NEXT_PUBLIC_API_BASE` — フロントが API にアクセスするベース URL。ローカル実行時は `http://localhost:8787` を推奨します。

変更点
- 新規: `apps/web/src/lib/ingest.ts`
  - toStartposUSI(input): KIF / CSA / USI を自動判定して startpos USI 文字列に正規化するユーティリティを追加。既存の `convertKif` の関数を活用。
  - splitKifGames(text): 複数局含む KIF を単純ヒューリスティクスで分割する関数を追加（MVP: 先頭ゲーム選択を想定）。
- 変更: `apps/web/src/components/AnnotateView.tsx`
  - ファイル読込（.kif/.kifu/.csa/.txt/.usi）ボタンを追加。
  - ドラッグ＆ドロップ領域を追加（テキストエリアを包む）。
  - クリップボードからの貼り付け解析ボタンを追加。
  - テキストエリアに対して onPaste と onBlur を追加し、貼り付けや離脱時に自動で toStartposUSI に通して `usi` を正規化して反映（エラー時は alert）。複数局 KIF を検出した場合はダイアログでゲーム選択できるようにした。
- 追加: `apps/web/src/lib/__tests__/ingest.test.ts` を追加（KIF/CSA/USI と複数局分割の基本テスト）。
- 変更: `backend/api/main.py` に環境変数 `USE_DUMMY_ENGINE=1` で DummyUSIEngine を利用する切替を追加（ローカル検証向け）。

動作確認
- Jest（フロント単体テスト）: 全テスト通過（18件）、TypeScript 型チェック（tsc）および Next.js の production ビルドも成功。
- バックエンド（`USE_DUMMY_ENGINE=1`）で手動確認: `GET /health` が {"status":"ok"}、`POST /annotate` が注釈 JSON を返すことを確認。
- フロント連携: `NEXT_PUBLIC_API_BASE=http://localhost:8787` で、ファイル貼り付け→USI 正規化→Annotate / Digest（10秒ダイジェスト）まで動作確認済み。

補足（CI）: Web CI (`.github/workflows/web-ci.yml`) を追加しました — このワークフローは `apps/web/**` の変更に対して型チェック／リンタ／テスト／ビルドを自動で実行します。

環境変数
- USE_DUMMY_ENGINE=1 — バックエンドで DummyUSIEngine を利用（ローカル開発用）
- NEXT_PUBLIC_API_BASE — フロントが API にアクセスするベース URL（例: http://localhost:8787）

既知の TODO / 注意点
- ESLint による警告が数件残っています（未使用の変数等）。現在は警告であり動作には影響しませんが、CI 設定によっては警告を fail とする場合があるため、必要なら修正します。
- KIF の複数局分割はヒューリスティック（空行や「までNN手」「開始日時/終了日時」等）です。特殊ケースや多様な表記には未対応の可能性があるため、必要なら分割ロジックを強化してゲーム選択 UI を改善してください。
- toStartposUSI は MVP 実装で、より堅牢な変換（例: 罫線・コメント除去、分割の詳細なパース）は将来の改善案です。

PR タイトル案:
- feat(annotate): ingest KIF/CSA/USI → normalize to USI, file/paste/D&D, multi-game

Labels / Reviewers / Checklist
- Labels (提案): `feat`, `web`, `backend`, `ci`
- Reviewers (提案): @<frontend-owner>, @<backend-owner>  （※実際のレビュワー名に差し替えてください）
- PR チェックリスト:
  - [ ] PR 本文をこのファイルの内容で貼り付け／確認
  - [ ] GitHub Actions (web CI) が green（`apps/web/**` の型・lint・test・build）
  - [ ] Backend CI（pytest）が green
  - [ ] 手動スモーク: Annotate ページでファイル貼付→USI 正規化→注釈/ダイジェストを確認
  - [ ] CI で指摘された lint/型の警告を解消（必要に応じて）
  - [ ] Optional: alert→Toast など UX 改善を別 PR で提案/実装
