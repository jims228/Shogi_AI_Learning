# RELEASE_PLAN (Android MVP / 2026-02)

将棋学習アプリ（Shogi_AI_Learning）の **Android向けMVP（クローズドβ可）** を、最短で「インストールできて学習導線が最後まで通る」状態で出すためのリリース一本道ドキュメントです。

---

## MVPのゴール（最重要）

- **Androidでインストールでき、起動して学習導線が最後まで通る**
- **初心者ロードマップ**（章→レッスン一覧→レッスン→完了→次へ）
- **レッスン最低10本**（テンプレで量産できる構造）
- **進捗保存**（ログイン無し / まずはローカル保存）
- **フィードバック導線**（Google FormなどのURLでOK）
- **AI解説はβ扱いで1箇所だけ**（例：レッスン末尾の「今回のポイント解説」）
  - 精度より **ログ**（入力/出力/評価/lessonId）を残して改善できること

---

## 既存実装の状況（監査結果サマリ）

このリポジトリは monorepo（pnpm workspace）で、MVPのAndroidは `apps/mobile` で実現します。

- **モバイル**: `apps/mobile`
  - Expo（SDK 54）+ React Native
  - 画面構成:
    - `RoadmapHome`（章一覧）
    - `UnitDetail`（レッスン一覧）
    - `LessonLaunch`（WebViewでWebレッスンを開く）
    - `Settings`（WebBaseURL等の設定）
  - **進捗保存**: AsyncStorage（`apps/mobile/src/state/progress.tsx`）
  - **レッスン完了通知**: WebView `postMessage` を受けて完了扱い（フォールバックあり）
- **Web**: `apps/web`（Next.js 16）
  - レッスンページが多数（`apps/web/src/lessons/**`）
  - ロードマップのソースは `apps/web/src/constants.ts`（`LESSONS`配列）
  - ロードマップJSON生成: `scripts/export_roadmap_json.js`
    - 出力先: `apps/mobile/src/data/roadmap.json` / `apps/web/public/roadmap.json`
- **Backend**: `apps/backend`（FastAPI）※MVP必須ではない（AI/ログ送信の発展先）

---

## Androidビルド/起動手順（開発）

### 前提

- Node 20+（推奨）
- pnpm（`packageManager` は `pnpm@10.22.0`）

### 依存インストール

```bash
cd /home/jimjace/Shogi_AI_Learning
pnpm install
```

### ローカル開発（WSL2 + Android実機想定）

WSL側（Web + Metro 固定ポートで起動）:

```bash
cd /home/jimjace/Shogi_AI_Learning
pnpm dev:android
```

- Web（Next.js）: `http://0.0.0.0:3000`
- Expo Metro: `http://localhost:8081`（固定）

Windows側（PowerShell / adb reverse）:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\android-usb-dev.ps1
```

端末側:

- Expo Goで `exp://127.0.0.1:8081` を開く
- アプリ → Settings → **USB (127.0.0.1)** を押す（`WEB_BASE_URL=http://127.0.0.1:3000` を設定）

---

## 配布（クローズドβ: 最短）

MVPはまず **EAS Build（internal配布）** を前提にします（署名/Gradle環境を最短化）。

### EAS build（Android / preview）

```bash
cd /home/jimjace/Shogi_AI_Learning
pnpm -C apps/mobile dlx eas-cli login
pnpm -C apps/mobile dlx eas-cli build --platform android --profile preview
```

- `apps/mobile/eas.json` の `preview` は `"distribution": "internal"`
- 生成物（APK/AAB）の配布は EAS のリンクで実施（クローズドβ）

---

## MVPの範囲（やること）

- モバイルのロードマップ導線を **クラッシュなく最後まで** 通す
- 10レッスンが確実に開けて完了できる（WebView側含む）
- 進捗がアプリ再起動後も維持される
- フィードバックリンクがモバイル内から開ける
- AI解説β（1箇所）とログ保存（最低: ローカル）

---

## やらないこと（MVPでは切る）

- ログイン/アカウント/クラウド同期
- 大規模リファクタ/設計刷新
- 完璧な学習設計（内容の品質より導線の完走）
- AIの精度改善（まずは出してログを取る）
- リセット機能の一般公開（必要ならデバッグ用途に限定）

---

## リリース前チェックリスト（最低限）

- [ ] `pnpm dev:android` がローカルでエラーなく起動できる
- [ ] Android端末で起動→`ロードマップ` 画面表示
- [ ] 章→レッスン一覧→レッスンを開く（WebView表示）
- [ ] レッスン完了→次へ（完了が保存され、一覧に反映）
- [ ] 再起動後も完了状態が残る
- [ ] フィードバック導線が開ける
- [ ] AI解説βが表示でき、👍/👎が記録される（失敗時フォールバックあり）
- [ ] `pnpm -C apps/mobile typecheck` が通る
- [ ] EAS preview build（Android）が成功し、APK/AABを取得できる

---

## Phase A（実機スモーク）チェック & メモ

この欄は「**実機で1周通した証跡**」として残します（A/B/C/Dを1回通せばPhase A合格）。

### Phase Aステータス

- [ ] Phase A 完全合格（Android実機で A/B/C/D を1周）

### 実機での確認手順（短縮版）

- **A. ロードマップ**: アプリ起動 → `ロードマップ` が表示される
- **B. レッスンWebView**: 任意のレッスンを開き、WebViewで表示される
- **C. 完了反映**: レッスン完了 → 戻った時に完了表示（チェック/進捗%）が付く
- **D. 再起動保持**: アプリ強制終了 → 再起動 → 完了状態が保持される（AsyncStorage）

### 実機メモ（記入欄）

- **Date**:
- **Device**:
- **Expo Go / Dev Client**:
- **WEB_BASE_URL**:（例: `http://127.0.0.1:3000` / `http://10.0.2.2:3000`）
- **Metro**:（例: `exp://127.0.0.1:8081`）
- **MVP対象レッスン（例）**: `basics_pawn_0`
- **結果**:（OK/NG、NGならどこで失敗したか A/B/C/D）
- **添付ログ**:
  - WSL: `pnpm dev:android` 抜粋
  - Windows: `adb reverse --list` / `adb logcat`（必要時）

## Assumptions（推測して進めた点）

- Android配布は、まず **EAS Build internal（preview）** を採用する（最短・壊れにくい）。
- レッスン本体のUI/テンプレは、当面 `apps/web` 側の `/training/**` を利用し、モバイルはWebViewで開く方針を維持する。
- AI解説βは **1箇所** に限定し、まずはローカル保存ログで改善ループを回す（API送信は後回し）。

