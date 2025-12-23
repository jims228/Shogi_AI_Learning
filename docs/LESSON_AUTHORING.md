# レッスン量産（データ駆動）ガイド

このリポジトリでは、既存のページ実装（`LessonScaffold` / `ShogiBoard`）を維持しながら、**レッスンをデータで量産**できるようにするために `LessonRunner` と `LessonStep` スキーマを追加しています。

## 関連ファイル

- レッスンスキーマ（型）: `apps/web/src/lib/training/lessonTypes.ts`
- 期待手判定（MoveSpec一致）: `apps/web/src/lib/training/moveJudge.ts`
- レッスン再生（guided/practice/review）: `apps/web/src/components/training/lesson/LessonRunner.tsx`
- サンプル（継ぎ歩V2）: `apps/web/src/lessons/pawn/tsugifu.ts`
- ページ: `apps/web/src/app/training/basics/pawn/tsugifu/page.tsx`

## Square 座標のルール

`Square = { file: 1..9, rank: 1..9 }`（将棋の筋・段）です。

- `file=1` は **右端（1筋）**
- `rank=1` は **上段（一段目）**

## MoveSpec（期待手）について

`MoveSpec` は「正解（または許容手）」を統一表現で書くための型です。

```ts
type MoveSpec =
  | { kind: "move"; from: Square; to: Square; promote?: boolean }
  | { kind: "drop"; piece: PieceBase; to: Square };
```

- `move`: 盤上の駒移動（`from`→`to`）
  - `promote`: `true`（成る）/ `false`（成らない）/ `undefined`（どちらでもOK）
- `drop`: 持ち駒を打つ

判定は `apps/web/src/lib/training/moveJudge.ts` の `isExpectedMove()` が担当します。

## LessonStep（guided / practice / review）

### guided

矢印誘導付きで手順を体験させます。`substeps` に複数の手順を持てます。

- **1つの substep で1手を要求**: `expectedMoves` を1つ以上入れる
- **自動で進む substep**: `expectedMoves: []` にして `autoAdvanceMs` を指定する
- substep 単位で局面を固定したい場合は `substep.sfen` を使う（既存の `scriptPhases` 互換用）

### practice

複数問のクイズです。`problems[]` を 3〜10 問程度入れる想定です。

- 通常は矢印なし
- `hints` を入れておくと、UIの「ヒント（矢印）」ボタンで表示できます

### review（MVP）

MVP では `source: "mistakesInThisLesson"` のみ対応しており、**このレッスン内の練習問題で間違えた問題**を再出題します。

## 新しいレッスンを追加する手順（最小）

1) `apps/web/src/lessons/<skill>/<name>.ts` を作成し、`LessonStep[]` を export  
2) 該当ページで `LessonRunner` に渡す

例（継ぎ歩）: `apps/web/src/app/training/basics/pawn/tsugifu/page.tsx`

## 手筋（tesuji）Lv1 の URL 一覧（App Router）

### pawn

- `/training/tesuji/pawn/tataki`
- `/training/tesuji/pawn/renda`
- `/training/tesuji/pawn/hikae`
- `/training/tesuji/pawn/sokobu`
- `/training/tesuji/pawn/tarefu`
- `/training/tesuji/pawn/tsugifu`

### silver

- `/training/tesuji/silver/warigin`
- `/training/tesuji/silver/keitogin`
- `/training/tesuji/silver/haragin`

### gold

- `/training/tesuji/gold/atamakin`
- `/training/tesuji/gold/shirikin`

### lance

- `/training/tesuji/lance/dengaku-sashi`
- `/training/tesuji/lance/2dan-rocket`
- `/training/tesuji/lance/sokokyo`

### knight

- `/training/tesuji/knight/fundoshi-kei`
- `/training/tesuji/knight/futo-no-kei`
- `/training/tesuji/knight/tsurushi-kei`
- `/training/tesuji/knight/hikae-kei`
- `/training/tesuji/knight/tsugikei`

### bishop

- `/training/tesuji/bishop/kaku-ryotori`
- `/training/tesuji/bishop/suji-chigai`
- `/training/tesuji/bishop/kaku-kei`
- `/training/tesuji/bishop/kobo-kaku`

### rook

- `/training/tesuji/rook/juji-hisha`
- `/training/tesuji/rook/home-rook-drop`
- `/training/tesuji/rook/ikken-ryu`
- `/training/tesuji/rook/okuri`

## 囲い（castle）Lv1 の URL 一覧（App Router）

- `/training/castle/yagura`
- `/training/castle/funagakoi`
- `/training/castle/mino`
- `/training/castle/hidari-mino`
- `/training/castle/anaguma`
- `/training/castle/kinmusou`
- `/training/castle/nakazumai`

## 戦法（opening）Lv1 の URL 一覧（App Router）

- `/training/opening/yagura-opening`
- `/training/opening/kaku-gawari`
- `/training/opening/yokofudori`
- `/training/opening/aigakari`
- `/training/opening/shikenbisha`
- `/training/opening/sankenbisha`
- `/training/opening/mukai-bisha`
- `/training/opening/nakabisha`

## 品質ゲート（最低限）

```bash
cd /home/jimjace/Shogi_AI_Learning
pnpm -C apps/web typecheck
pnpm -C apps/web lint
pnpm -C apps/web validate-lessons
```

## 再発防止：SFENバリデーション

`pnpm -C apps/web validate-lessons` は、`apps/web/src/lessons/**` の全 step/substep/problem の `sfen` を検査します。

- **buildPositionFromUsi に通ること**
- **盤面に `K` と `k` が1枚ずつあること（王2枚等を検出）**

## 一括生成（雛形）

全27手筋 Lv1 の「雛形＋最低限データ」をまとめて生成するスクリプト:

```bash
cd /home/jimjace/Shogi_AI_Learning
node scripts/gen_all_tesuji_l1.js
```

- **既に存在するファイルは上書きしません**（実データを壊さない）
  - 例: `pawn/tarefu.ts`, `pawn/tsugifu.ts`, `silver/warigin.ts` など

### 囲い（castle）Lv1 の一括生成

```bash
cd /home/jimjace/Shogi_AI_Learning
node scripts/gen_all_castle_l1.js
```

### 戦法（opening）Lv1 の一括生成

```bash
cd /home/jimjace/Shogi_AI_Learning
node scripts/gen_all_opening_l1.js
```


