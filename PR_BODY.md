目的
- ユーザーが持つ対局データ（KIF / CSA / USI）をブラウザ側で受け取り、USI 形式（startpos moves ...）へ自動正規化して、既存の /annotate と /digest ワークフローへ繋げられるようにする。
- 開発環境で実エンジンが無くても動かせるようにダミーエンジン切替を追加し、ローカル検証を容易にする。

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
- 単体テスト（Jest）: 全テスト通過（18 tests）
- TypeScript 型チェック: 問題なし（`tsc --noEmit` 成功）
- Next.js ビルド: 成功（production build / static pages 生成 OK）
- 手動 API 確認（ダミーエンジンあり）:
  - `GET /health` → {"status":"ok"}
  - `POST /annotate` (USI 入力) → 注釈 JSON が返る（ダミー bestmove を含む）
- フロント連携:
  - `NEXT_PUBLIC_API_BASE` を `http://localhost:8787` に設定しておけば、Annotate ページの「ファイル読込」/「貼り付け解析」で USI が textarea に自動反映され、そのまま「注釈を生成」「10秒ダイジェスト」が動きます。

環境変数
- USE_DUMMY_ENGINE=1 — バックエンドで DummyUSIEngine を利用（ローカル開発用）
- NEXT_PUBLIC_API_BASE — フロントが API にアクセスするベース URL（例: http://localhost:8787）

既知の TODO / 注意点
- ESLint による警告が数件残っています（未使用の変数等）。現在は警告であり動作には影響しませんが、CI 設定によっては警告を fail とする場合があるため、必要なら修正します。
- KIF の複数局分割はヒューリスティック（空行や「までNN手」「開始日時/終了日時」等）です。特殊ケースや多様な表記には未対応の可能性があるため、必要なら分割ロジックを強化してゲーム選択 UI を改善してください。
- toStartposUSI は MVP 実装で、より堅牢な変換（例: 罫線・コメント除去、分割の詳細なパース）は将来の改善案です。

PR タイトル案:
- feat(annotate): ingest KIF/CSA/USI → normalize to USI, file/paste/D&D, multi-game
