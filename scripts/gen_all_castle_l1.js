/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

// Register ts-node from apps/web so we can require TS catalogs (Next alias not needed).
process.env.TS_NODE_TRANSPILE_ONLY = "1";
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
});
const tsNodeRegisterPath = require.resolve("ts-node/register/transpile-only", {
  paths: [path.resolve(__dirname, "../apps/web")],
});
require(tsNodeRegisterPath);

const { CASTLE_CATALOG } = require("../apps/web/src/lessons/castle/catalog");

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
  const constName = `CASTLE_${safeIdentFromId(id)}_L1`;
  // Minimal legal base position (k at 5一, K at 5九) + 金銀を1枚ずつ配置して“形”を作る
  // Board coordinates: file=1..9 (right->left), rank=1..9 (top->bottom)
  // We'll use simple “one-step” piece moves to target squares.
  const sfen0 = "position sfen 4k4/9/9/9/9/9/9/9/4K4 b - 1";
  const sfen1 = "position sfen 4k4/9/9/9/9/9/9/5G3/4K4 b - 1"; // G at 4八
  const sfen2 = "position sfen 4k4/9/9/9/9/9/9/5GS2/4K4 b - 1"; // G at 4八, S at 3八

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
    sfen: "${sfen2}",
    orientation: "sente",
    substeps: [
      {
        prompt: "まずは守りの形を作ろう。金を1マス動かしてね（4八→4七）。",
        sfen: "${sfen2}",
        arrows: [{ from: sq(4, 8), to: sq(4, 7), kind: "move" }],
        highlights: [sq(4, 7)],
        expectedMoves: [{ kind: "move", from: sq(4, 8), to: sq(4, 7) }],
        after: "auto",
        wrongHint: "金を指定のマスへ。囲いは“形”を順に作るよ。",
      },
      {
        prompt: "次は銀。銀を1マス動かしてね（3八→3七）。",
        sfen: "${sfen2}",
        arrows: [{ from: sq(3, 8), to: sq(3, 7), kind: "move" }],
        highlights: [sq(3, 7)],
        expectedMoves: [{ kind: "move", from: sq(3, 8), to: sq(3, 7) }],
        after: "auto",
        wrongHint: "銀を指定のマスへ。金銀で玉を囲う感覚を覚えよう。",
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
        question: "第1問：金を4七へ。",
        sfen: "${sfen2}",
        expectedMoves: [{ kind: "move", from: sq(4, 8), to: sq(4, 7) }],
        hints: { arrows: [{ from: sq(4, 8), to: sq(4, 7), kind: "move" }], highlights: [sq(4, 7)] },
        explanation: "まずは金を近づけて、玉の周りを固める。",
      },
      {
        question: "第2問：銀を3七へ。",
        sfen: "${sfen2}",
        expectedMoves: [{ kind: "move", from: sq(3, 8), to: sq(3, 7) }],
        hints: { arrows: [{ from: sq(3, 8), to: sq(3, 7), kind: "move" }], highlights: [sq(3, 7)] },
        explanation: "銀も寄せて、守りの形を作る。",
      },
      {
        question: "第3問：金を4八→5八へ（横）。",
        sfen: "${sfen1}",
        expectedMoves: [{ kind: "move", from: sq(4, 8), to: sq(5, 8) }],
        hints: { arrows: [{ from: sq(4, 8), to: sq(5, 8), kind: "move" }], highlights: [sq(5, 8)] },
        explanation: "金は横にも動ける。玉の近くに寄せる。",
      },
      {
        question: "第4問：金を4八→3八へ（横）。",
        sfen: "${sfen1}",
        expectedMoves: [{ kind: "move", from: sq(4, 8), to: sq(3, 8) }],
        hints: { arrows: [{ from: sq(4, 8), to: sq(3, 8), kind: "move" }], highlights: [sq(3, 8)] },
        explanation: "金を横に寄せて、囲いの形を作る練習。",
      },
      {
        question: "第5問：銀を3八→4七へ（斜め）。",
        sfen: "position sfen 4k4/9/9/9/9/9/9/6S2/4K4 b - 1",
        expectedMoves: [{ kind: "move", from: sq(3, 8), to: sq(4, 7) }],
        hints: { arrows: [{ from: sq(3, 8), to: sq(4, 7), kind: "move" }], highlights: [sq(4, 7)] },
        explanation: "銀は斜めにも動ける。玉の近くへ寄せよう。",
      },
      {
        question: "第6問：銀を3八→2七へ（斜め）。",
        sfen: "position sfen 4k4/9/9/9/9/9/9/6S2/4K4 b - 1",
        expectedMoves: [{ kind: "move", from: sq(3, 8), to: sq(2, 7) }],
        hints: { arrows: [{ from: sq(3, 8), to: sq(2, 7), kind: "move" }], highlights: [sq(2, 7)] },
        explanation: "囲いは左右どちら側にも作れる。形を覚える。",
      },
      {
        question: "第7問：金銀を寄せる前準備：金を4八→4七。",
        sfen: "${sfen1}",
        expectedMoves: [{ kind: "move", from: sq(4, 8), to: sq(4, 7) }],
        hints: { arrows: [{ from: sq(4, 8), to: sq(4, 7), kind: "move" }], highlights: [sq(4, 7)] },
        explanation: "囲いは“まず金から”が多い。順番を体に入れる。",
      },
      {
        question: "第8問：銀を寄せる前準備：銀を3八→3七。",
        sfen: "position sfen 4k4/9/9/9/9/9/9/6S2/4K4 b - 1",
        expectedMoves: [{ kind: "move", from: sq(3, 8), to: sq(3, 7) }],
        hints: { arrows: [{ from: sq(3, 8), to: sq(3, 7), kind: "move" }], highlights: [sq(3, 7)] },
        explanation: "金の次は銀。近づけて固める。",
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
import { ${constName} } from "@/lessons/castle/${id}";

export default function Castle_${safeIdentFromId(id)}_Page() {
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

  for (const item of CASTLE_CATALOG) {
    if (!item.levelSet?.includes("L1")) continue;
    const { constName, content } = makeLessonTemplate(item);

    const lessonFile = path.join(repoRoot, "apps/web/src/lessons/castle", `${item.id}.ts`);
    if (writeFileIfMissing(lessonFile, content)) createdLessons.push(path.relative(repoRoot, lessonFile));

    const pageFile = path.join(repoRoot, "apps/web/src/app/training/castle", item.id, "page.tsx");
    const pageContent = makePageTemplate({ ...item, constName });
    if (writeFileIfMissing(pageFile, pageContent)) createdPages.push(path.relative(repoRoot, pageFile));
  }

  console.log(`gen-all-castle-l1: lessons created ${createdLessons.length}, pages created ${createdPages.length}`);
  if (createdLessons.length) createdLessons.forEach((p) => console.log(`  + ${p}`));
  if (createdPages.length) createdPages.forEach((p) => console.log(`  + ${p}`));
}

main();


