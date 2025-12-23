/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

process.env.TS_NODE_TRANSPILE_ONLY = "1";
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
});
const tsNodeRegisterPath = require.resolve("ts-node/register/transpile-only", {
  paths: [path.resolve(__dirname, "../apps/web")],
});
require(tsNodeRegisterPath);

const { OPENING_CATALOG } = require("../apps/web/src/lessons/opening/catalog");

function safeIdentFromId(id) {
  return id.replace(/[^a-zA-Z0-9]+/g, "_").replace(/^(\d)/, "_$1").toUpperCase();
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function writeFileIfMissing(filePath, content) {
  if (fs.existsSync(filePath)) return false;
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content, "utf-8");
  return true;
}

function makeLessonTemplate({ id, nameJa }) {
  const constName = `OPENING_${safeIdentFromId(id)}_L1`;
  // Minimal legal base position: kings only + a few pawns/bishop/rook for “shape”.
  const base = "position sfen 4k4/9/9/9/9/9/9/9/4K4 b - 1";
  const pawn7 = "position sfen 4k4/9/9/9/9/9/9/2P6/4K4 b - 1"; // pawn at 7八? actually file7 rank8 => row8 col3 => "2P6"
  const bishop = "position sfen 4k4/9/9/9/9/9/1B7/9/4K4 b - 1"; // bishop at 8七? file8 rank7 -> row7 "1B7"
  const rook = "position sfen 4k4/9/9/9/9/9/9/4R4/4K4 b - 1"; // rook at 5八

  return {
    constName,
    content: `import type { LessonStep, Square } from "../../lib/training/lessonTypes";

const sq = (file: number, rank: number): Square => ({ file, rank });

/**
 * ${nameJa}（Lv1）
 * - TODO: 後で実戦に近い局面へ差し替え（外部記事の転載はしない）
 */
export const ${constName}: LessonStep[] = [
  {
    type: "guided",
    title: "${nameJa}（Lv1）: ガイド",
    sfen: "${pawn7}",
    orientation: "sente",
    substeps: [
      {
        prompt: "まずは歩を前へ。7八の歩を7七へ。",
        sfen: "${pawn7}",
        arrows: [{ from: sq(7, 8), to: sq(7, 7), kind: "move" }],
        highlights: [sq(7, 7)],
        expectedMoves: [{ kind: "move", from: sq(7, 8), to: sq(7, 7) }],
        after: "auto",
        wrongHint: "まずは歩を1つ進めて、形を作ろう。",
      },
      {
        prompt: "次は角道を意識。角を一歩動かしてみよう（8七→7六）。",
        sfen: "${bishop}",
        arrows: [{ from: sq(8, 7), to: sq(7, 6), kind: "move" }],
        highlights: [sq(7, 6)],
        expectedMoves: [{ kind: "move", from: sq(8, 7), to: sq(7, 6) }],
        after: "auto",
        wrongHint: "角を動かしてラインを作る練習。",
      },
      {
        prompt: "OK！次は練習（8問）へ。",
        expectedMoves: [],
        autoAdvanceMs: 450,
      },
    ],
  },
  {
    type: "practice",
    title: "${nameJa}（Lv1）: 練習",
    sfen: "position startpos",
    orientation: "sente",
    problems: [
      {
        question: "第1問：歩を7七へ。",
        sfen: "${pawn7}",
        expectedMoves: [{ kind: "move", from: sq(7, 8), to: sq(7, 7) }],
        hints: { arrows: [{ from: sq(7, 8), to: sq(7, 7), kind: "move" }], highlights: [sq(7, 7)] },
        explanation: "序盤は、まず歩を進めて形を作る。",
      },
      {
        question: "第2問：歩を7六へ（もう1つ）。",
        sfen: "position sfen 4k4/9/9/9/9/9/2P6/9/4K4 b - 1",
        expectedMoves: [{ kind: "move", from: sq(7, 7), to: sq(7, 6) }],
        hints: { arrows: [{ from: sq(7, 7), to: sq(7, 6), kind: "move" }], highlights: [sq(7, 6)] },
        explanation: "歩を進めて、前線を作る。",
      },
      {
        question: "第3問：角を動かす（8七→7六）。",
        sfen: "${bishop}",
        expectedMoves: [{ kind: "move", from: sq(8, 7), to: sq(7, 6) }],
        hints: { arrows: [{ from: sq(8, 7), to: sq(7, 6), kind: "move" }], highlights: [sq(7, 6)] },
        explanation: "角道を通す意識を持とう。",
      },
      {
        question: "第4問：角を別のマスへ（8七→6五）。",
        sfen: "${bishop}",
        expectedMoves: [{ kind: "move", from: sq(8, 7), to: sq(6, 5) }],
        hints: { arrows: [{ from: sq(8, 7), to: sq(6, 5), kind: "move" }], highlights: [sq(6, 5)] },
        explanation: "角は斜めのラインで働く。",
      },
      {
        question: "第5問：飛車を前へ（5八→5七）。",
        sfen: "${rook}",
        expectedMoves: [{ kind: "move", from: sq(5, 8), to: sq(5, 7) }],
        hints: { arrows: [{ from: sq(5, 8), to: sq(5, 7), kind: "move" }], highlights: [sq(5, 7)] },
        explanation: "大駒は“ライン”を作る意識。",
      },
      {
        question: "第6問：飛車を横へ（5八→6八）。",
        sfen: "${rook}",
        expectedMoves: [{ kind: "move", from: sq(5, 8), to: sq(6, 8) }],
        hints: { arrows: [{ from: sq(5, 8), to: sq(6, 8), kind: "move" }], highlights: [sq(6, 8)] },
        explanation: "振り飛車の“振る”感覚の入口。",
      },
      {
        question: "第7問：飛車を横へ（5八→4八）。",
        sfen: "${rook}",
        expectedMoves: [{ kind: "move", from: sq(5, 8), to: sq(4, 8) }],
        hints: { arrows: [{ from: sq(5, 8), to: sq(4, 8), kind: "move" }], highlights: [sq(4, 8)] },
        explanation: "飛車は横にも動ける。",
      },
      {
        question: "第8問：基本の確認：歩を1つ進める（7八→7七）。",
        sfen: "${pawn7}",
        expectedMoves: [{ kind: "move", from: sq(7, 8), to: sq(7, 7) }],
        hints: { arrows: [{ from: sq(7, 8), to: sq(7, 7), kind: "move" }], highlights: [sq(7, 7)] },
        explanation: "まずは“形”。1手ずつ積み上げる。",
      },
    ],
  },
  {
    type: "review",
    title: "${nameJa}（Lv1）: 復習",
    sfen: "position startpos",
    orientation: "sente",
    source: "mistakesInThisLesson",
    count: 4,
  },
];
`,
  };
}

function makePageTemplate({ id, nameJa, constName }) {
  const title = `${nameJa}（Lv1）`;
  return `"use client";

import React from "react";
import { LessonRunner } from "@/components/training/lesson/LessonRunner";
import { ${constName} } from "@/lessons/opening/${id}";

export default function Opening_${safeIdentFromId(id)}_Page() {
  return (
    <LessonRunner
      title="${title}"
      backHref="/learn/roadmap"
      steps={${constName}}
      headerRight={<span>❤ 4</span>}
      desktopMinWidthPx={820}
      onFinishHref="/learn/roadmap"
    />
  );
}
`;
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const createdLessons = [];
  const createdPages = [];

  for (const item of OPENING_CATALOG) {
    if (!item.levelSet?.includes("L1")) continue;
    const { constName, content } = makeLessonTemplate(item);

    const lessonFile = path.join(repoRoot, "apps/web/src/lessons/opening", `${item.id}.ts`);
    if (writeFileIfMissing(lessonFile, content)) createdLessons.push(path.relative(repoRoot, lessonFile));

    const pageFile = path.join(repoRoot, "apps/web/src/app/training/opening", item.id, "page.tsx");
    const pageContent = makePageTemplate({ ...item, constName });
    if (writeFileIfMissing(pageFile, pageContent)) createdPages.push(path.relative(repoRoot, pageFile));
  }

  console.log(`gen-all-opening-l1: lessons created ${createdLessons.length}, pages created ${createdPages.length}`);
  if (createdLessons.length) createdLessons.forEach((p) => console.log(`  + ${p}`));
  if (createdPages.length) createdPages.forEach((p) => console.log(`  + ${p}`));
}

main();


