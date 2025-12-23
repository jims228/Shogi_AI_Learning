/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

// Register ts-node from apps/web so we can require TS catalog.
process.env.TS_NODE_TRANSPILE_ONLY = "1";
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
});
const tsNodeRegisterPath = require.resolve("ts-node/register/transpile-only", {
  paths: [path.resolve(__dirname, "../apps/web")],
});
require(tsNodeRegisterPath);

const { TESUJI_CATALOG } = require("../apps/web/src/lessons/tesuji/catalog");

const PIECE_HAND = {
  pawn: "P",
  lance: "L",
  knight: "N",
  silver: "S",
  gold: "G",
  bishop: "B",
  rook: "R",
};

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

function makeLessonTemplate({ piece, id, techniqueNameJa }) {
  const letter = PIECE_HAND[piece];
  const constName = `${piece.toUpperCase()}_${safeIdentFromId(id)}_L1`;

  // Minimal, always-valid base position: kings only + 2 pieces in hand.
  const baseSfen = `position sfen 4k4/9/9/9/9/9/9/9/4K4 b 2${letter} 1`;

  // Two guided drops so the learner “does something twice”.
  const guidedA = { file: 5, rank: 5 };
  const guidedB = { file: 5, rank: 4 };

  // 8 practice targets (spread around center)
  const practiceTargets = [
    { file: 5, rank: 5 },
    { file: 5, rank: 4 },
    { file: 4, rank: 5 },
    { file: 6, rank: 5 },
    { file: 4, rank: 4 },
    { file: 6, rank: 4 },
    { file: 5, rank: 6 },
    { file: 5, rank: 3 },
  ];

  return {
    constName,
    content: `import type { LessonStep, Square } from "../../lib/training/lessonTypes";

const sq = (file: number, rank: number): Square => ({ file, rank });

/**
 * ${techniqueNameJa}（Lv1）
 * - TODO: 後で局面/狙いを厚くする（外部記事の転載はしない）
 */
export const ${constName}: LessonStep[] = [
  {
    type: "guided",
    title: "${techniqueNameJa}（Lv1）: ガイド",
    sfen: "${baseSfen}",
    orientation: "sente",
    substeps: [
      {
        prompt: "まずは形を作ろう。${techniqueNameJa}の“入口”として、ここに打ってみてね。",
        arrows: [{ to: sq(${guidedA.file}, ${guidedA.rank}), kind: "drop", dir: "hand", hand: "sente" }],
        highlights: [sq(${guidedA.file}, ${guidedA.rank})],
        expectedMoves: [{ kind: "drop", piece: "${letter}", to: sq(${guidedA.file}, ${guidedA.rank}) }],
        after: "auto",
        wrongHint: "まずは指定のマスに打って形を作ろう。",
      },
      {
        prompt: "（形ができた）",
        sfen: "${baseSfen}",
        expectedMoves: [],
        autoAdvanceMs: 240,
      },
      {
        prompt: "もう一度。次はここに打ってみてね。",
        arrows: [{ to: sq(${guidedB.file}, ${guidedB.rank}), kind: "drop", dir: "hand", hand: "sente" }],
        highlights: [sq(${guidedB.file}, ${guidedB.rank})],
        expectedMoves: [{ kind: "drop", piece: "${letter}", to: sq(${guidedB.file}, ${guidedB.rank}) }],
        after: "auto",
        wrongHint: "2回目も指定のマスに打とう。",
      },
      {
        prompt: "OK！次は練習問題（8問）へ。",
        expectedMoves: [],
        autoAdvanceMs: 450,
      },
    ],
  },
  {
    type: "practice",
    title: "${techniqueNameJa}（Lv1）: 練習",
    sfen: "position startpos",
    orientation: "sente",
    problems: [
${practiceTargets
  .map(
    (t, i) => `      {
        question: "第${i + 1}問：このマスに打って形を作ろう。",
        sfen: "${baseSfen}",
        expectedMoves: [{ kind: "drop", piece: "${letter}", to: sq(${t.file}, ${t.rank}) }],
        hints: {
          arrows: [{ to: sq(${t.file}, ${t.rank}), kind: "drop", dir: "hand", hand: "sente" }],
          highlights: [sq(${t.file}, ${t.rank})],
        },
        explanation: "まずは“形”を作る練習。あとで局面を実戦寄りにします。",
      },`
  )
  .join("\n")}
    ],
  },
  {
    type: "review",
    title: "${techniqueNameJa}（Lv1）: 復習",
    sfen: "position startpos",
    orientation: "sente",
    source: "mistakesInThisLesson",
    count: 4,
  },
];
`,
  };
}

function makePageTemplate({ piece, id, techniqueNameJa, constName }) {
  const title = `${techniqueNameJa}（Lv1）`;
  return `"use client";

import React from "react";
import { LessonRunner } from "@/components/training/lesson/LessonRunner";
import { ${constName} } from "@/lessons/${piece}/${id}";

export default function Tesuji_${safeIdentFromId(piece)}_${safeIdentFromId(id)}_Page() {
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

  for (const item of TESUJI_CATALOG) {
    if (!item.levelSet?.includes("L1")) continue;

    const { constName, content } = makeLessonTemplate(item);
    const lessonFile = path.join(repoRoot, "apps/web/src/lessons", item.piece, `${item.id}.ts`);
    if (writeFileIfMissing(lessonFile, content)) createdLessons.push(path.relative(repoRoot, lessonFile));

    const pageFile = path.join(repoRoot, "apps/web/src/app/training/tesuji", item.piece, item.id, "page.tsx");
    const pageContent = makePageTemplate({ ...item, constName });
    if (writeFileIfMissing(pageFile, pageContent)) createdPages.push(path.relative(repoRoot, pageFile));
  }

  console.log(`gen-all-tesuji-l1: lessons created ${createdLessons.length}, pages created ${createdPages.length}`);
  if (createdLessons.length) createdLessons.forEach((p) => console.log(`  + ${p}`));
  if (createdPages.length) createdPages.forEach((p) => console.log(`  + ${p}`));
}

main();


