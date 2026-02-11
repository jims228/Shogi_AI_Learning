# Smoke Test: Streaming and LLM Safety

目的: OpenAI 導入前後でリクエスト爆増や課金事故が起きないことを素早く検証する。

## 1. SSEが常に1本だけか
1) ブラウザで `AnalysisTab` を開く。
2) DevTools → Network → `text/event-stream` をフィルタ。
3) 解析開始 → 進行中に手数を数回移動。
4) 同時に開かれている SSE が常に1本であることを確認。

期待:
- 同じ `ply` で複数の SSE が並行して存在しない。

## 2. request_id ログのペア確認
1) コンソールに `[Analysis] connect` が出ることを確認。
2) 解析完了または停止で `[Analysis] disconnect` が出ることを確認。

期待:
- `request_id` が connect/disconnect で同一。
- `ply` が一致する。

## 3. 切断後にバックが止まるか
1) 解析中にタブを閉じる/Network をオフラインにする。
2) バックエンドログで `client_disconnect` が出ることを確認。
3) `stream_end` が必ず出ることを確認。

期待:
- 切断後にストリームがダラダラ走らない。

## 4. バッチ解析の中断確認
1) バッチ解析を開始。
2) 途中で停止ボタン or 画面遷移。
3) クライアントで `AbortError` が出ていないか確認。
4) Network で該当リクエストが `canceled` になることを確認。

期待:
- 中断後に再度開始しても問題なく動く。

## 5. OpenAI 導入後の課金防止スモーク
1) サーバの `max_output_tokens` 固定を確認。
2) 1ユーザ/分の rate limit を確認。
3) 日次の自前上限があることを確認。

期待:
- 上限に達した場合は `429` または明示的なエラーで停止する。
