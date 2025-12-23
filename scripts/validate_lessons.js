/* eslint-disable no-console */
// JS entrypoint so Node 22 can run it without a TS loader.
// We register ts-node to allow requiring TS modules below.
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

const fs = require("node:fs");

const { buildPositionFromUsi } = require("../apps/web/src/lib/board");
const { STARTPOS_SFEN } = require("../apps/web/src/lib/sfen");

function normalizeUsiPosition(s) {
  const t = (s ?? "").trim();
  if (!t) return "position startpos";
  if (t.startsWith("position ")) return t;
  if (t.startsWith("startpos")) return `position ${t}`;
  if (t.startsWith("sfen ")) return `position ${t}`;
  return `position sfen ${t}`;
}

function extractBoardPartFromPosition(cmd) {
  const norm = normalizeUsiPosition(cmd);
  const tokens = norm.split(/\s+/);
  if (tokens[0] === "position" && tokens[1] === "startpos") return STARTPOS_SFEN;
  const sfenIdx = tokens.findIndex((t) => t === "sfen");
  if (sfenIdx !== -1 && tokens[sfenIdx + 1]) return tokens[sfenIdx + 1];
  return null;
}

function countKings(boardPart) {
  let K = 0;
  let k = 0;
  for (let i = 0; i < boardPart.length; i++) {
    const ch = boardPart[i];
    if (ch === "+") {
      i++;
      continue;
    }
    if (ch === "K") K++;
    if (ch === "k") k++;
  }
  return { K, k };
}

function walkLessonFiles(dir) {
  const out = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walkLessonFiles(full));
    else if (ent.isFile() && ent.name.endsWith(".ts") && !ent.name.endsWith(".d.ts")) out.push(full);
  }
  return out;
}

function collectSfensFromLesson(steps) {
  const sfens = [];
  steps.forEach((step, si) => {
    if (!step) return;
    if (typeof step.sfen === "string") sfens.push({ where: `step[${si}].sfen`, sfen: step.sfen });
    if (step.type === "guided" && Array.isArray(step.substeps)) {
      step.substeps.forEach((sub, sj) => {
        if (sub?.sfen) sfens.push({ where: `step[${si}].substeps[${sj}].sfen`, sfen: sub.sfen });
      });
    }
    if (step.type === "practice" && Array.isArray(step.problems)) {
      step.problems.forEach((p, pj) => {
        if (p?.sfen) sfens.push({ where: `step[${si}].problems[${pj}].sfen`, sfen: p.sfen });
      });
    }
  });
  return sfens;
}

function validateLessonModule(absPath) {
  const mod = require(absPath);
  const exports = Object.entries(mod);
  const failures = [];

  for (const [key, value] of exports) {
    if (!Array.isArray(value)) continue;
    if (!value.every((x) => x && typeof x === "object" && typeof x.type === "string")) continue;

    const sfens = collectSfensFromLesson(value);
    for (const { where, sfen } of sfens) {
      const norm = normalizeUsiPosition(sfen);
      try {
        buildPositionFromUsi(norm);
      } catch (e) {
        failures.push(`- ${key} ${where}: buildPositionFromUsi failed: ${String(e?.message ?? e)}`);
        continue;
      }

      const boardPart = extractBoardPartFromPosition(sfen);
      if (boardPart) {
        const { K, k } = countKings(boardPart);
        if (K !== 1 || k !== 1) {
          failures.push(`- ${key} ${where}: invalid king count (K=${K}, k=${k}) in board="${boardPart}"`);
        }
      }
    }
  }

  return failures;
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const lessonsRoot = path.join(repoRoot, "apps/web/src/lessons");
  const files = walkLessonFiles(lessonsRoot).filter((p) => !p.endsWith(path.join("tesuji", "catalog.ts")));

  const allFailures = [];
  for (const f of files) {
    const errors = validateLessonModule(f);
    if (errors.length) allFailures.push({ file: path.relative(repoRoot, f), errors });
  }

  if (allFailures.length) {
    console.error("validate-lessons: FAILED");
    for (const { file, errors } of allFailures) {
      console.error(`\n${file}`);
      errors.forEach((e) => console.error(e));
    }
    process.exit(1);
  }

  console.log(`validate-lessons: OK (${files.length} files)`);
}

main();


