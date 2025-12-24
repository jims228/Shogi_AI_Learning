# Mobile Roadmap App (MVP)

目的: iOS/Android 向けに「ロードマップ専用」アプリを提供します。レッスン実行は **WebView で Web のレッスン画面を表示**します（AI/解析UIはモバイル導線に含めません）。

## 必要な環境変数（ローカル開発）

Expo の Public Env を使います（`EXPO_PUBLIC_` prefix）。

- `EXPO_PUBLIC_WEB_BASE_URL`（例: `http://localhost:3000`）
- `EXPO_PUBLIC_API_BASE_URL`（MVPでは未使用。将来同期用。例: `http://localhost:8787`）

## 起動手順（ローカル）

Web 側を起動:

```bash
pnpm --filter web dev
```

Mobile を起動:

```bash
pnpm -C apps/mobile start
```

## レッスン完了の反映

- WebView は `?mobile=1&lid=<lessonId>` を付与してレッスンを開きます。
- Web 側 `LessonRunner` が完了時に `window.ReactNativeWebView.postMessage(...)` を送信し、モバイル側が `AsyncStorage` の進捗を更新します。

## ロードマップデータ更新

ロードマップは Web 側の `apps/web/src/constants.ts` がソースで、以下のスクリプトで JSON を生成します:

```bash
node scripts/export_roadmap_json.js
```

生成先:
- `apps/web/public/roadmap.json`
- `apps/mobile/src/data/roadmap.json`


