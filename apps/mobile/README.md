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

## pnpm 前提（重要）

このモノレポは **pnpm workspace** です。`apps/mobile` も pnpm 前提で運用します。

- `package.json` の `"packageManager"` は `pnpm@10.22.0`
- yarn 用の `yarn.lock` / `.yarnrc.yml` は置きません

引数付きで起動する場合は `--` を使います:

```bash
pnpm -C apps/mobile start -- --localhost
```

## テスト配布（EAS Build）

前提:
- Expo アカウントが必要（`eas login`）
- iOS の TestFlight 配布は Apple Developer アカウントが必要（Macなしでも **EASのクラウドビルド** で可能）

### 1) 初回セットアップ

`apps/mobile` ディレクトリで実行します:

```bash
pnpm -C apps/mobile dlx eas-cli login
pnpm -C apps/mobile dlx eas-cli whoami
pnpm -C apps/mobile dlx eas-cli init
```

`eas init` が `extra.eas.projectId` を設定する場合があります（自動追記）。

### 2) Android（最短：preview build / internal）

```bash
pnpm -C apps/mobile dlx eas-cli build --platform android --profile preview
```

ビルド完了後、EASのリンクからAPK/AABをインストールして動作確認します。

### 3) iOS（Macなし：EASクラウド → TestFlight or internal）

```bash
pnpm -C apps/mobile dlx eas-cli build --platform ios --profile preview
```

### 4) Development build（Expo Go ではなく Dev Client）

ネイティブ依存を含む状態で開発/検証したい場合:

```bash
pnpm -C apps/mobile dlx eas-cli build --platform android --profile development
pnpm -C apps/mobile dlx eas-cli build --platform ios --profile development
```

## 端末向け設定（重要）

`apps/mobile/app.config.ts` で管理しています:
- `name / slug / scheme`
- `ios.bundleIdentifier`
- `android.package`

注意:
- 現状は **WebViewで `http://...` を開ける** ように、Android `usesCleartextTraffic=true` / iOS ATS を緩めています。
  本番配布では HTTPS を推奨します。

## 実機/エミュで確実に開くための WebBaseURL 設定（localhost問題）

モバイルは WebView で以下を開きます（固定）:

- `/m/lesson/<lessonId>?mobile=1&noai=1&lid=<lessonId>`

つまり **端末側から Web dev server に到達できる URL** が必要です。

- **Android Emulator**:
  - `WEB_BASE_URL = http://10.0.2.2:3000`
- **iOS Simulator**:
  - `WEB_BASE_URL = http://localhost:3000`（多くの環境でOK）
- **実機（iOS/Android）**:
  - Web を LAN 公開で起動:

```bash
pnpm --filter web dev -- --hostname 0.0.0.0 --port 3000
```

  - モバイルの Settings で:
    - `WEB_BASE_URL = http://<PCのLAN IP>:3000`

Tips:
- Settings の「LAN推定」ボタンは Expo の hostUri から LAN IP を推定して `http://<ip>:3000` を設定します（best-effort）。

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

## チェック（最低限）

```bash
pnpm -C apps/mobile typecheck
```


