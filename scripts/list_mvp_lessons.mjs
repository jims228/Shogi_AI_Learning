/* eslint-disable no-console */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

// Usage:
//   node scripts/list_mvp_lessons.mjs
//   node scripts/list_mvp_lessons.mjs --count 10 --write
//   node scripts/list_mvp_lessons.mjs --count 10 --write --verify http://localhost:3000

const require = createRequire(import.meta.url);

// Register ts-node from apps/web so we can require TS constants.
process.env.TS_NODE_TRANSPILE_ONLY = "1";
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
});
const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const tsNodeRegisterPath = require.resolve("ts-node/register/transpile-only", {
  paths: [path.resolve(repoRoot, "apps/web")],
});
require(tsNodeRegisterPath);

const { LESSONS } = require("../apps/web/src/constants");

function parseArgs(argv) {
  const out = { count: 10, write: false, verifyBase: null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--count") out.count = Number(argv[++i] || "10");
    if (a === "--write") out.write = true;
    if (a === "--verify") out.verifyBase = String(argv[++i] || "");
  }
  if (!Number.isFinite(out.count) || out.count <= 0) out.count = 10;
  if (out.verifyBase && out.verifyBase.endsWith("/")) out.verifyBase = out.verifyBase.slice(0, -1);
  return out;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

async function verifyOne(baseUrl, lessonId) {
  const u = `${baseUrl}/m/lesson/${encodeURIComponent(lessonId)}`;
  const r1 = await fetch(u, { redirect: "manual" });
  const loc = r1.headers.get("location") || "";
  if (r1.status !== 307 || !loc) return { ok: false, lessonId, status: r1.status, location: loc };
  const r2 = await fetch(`${baseUrl}${loc}`, { redirect: "manual" });
  if (r2.status !== 200) return { ok: false, lessonId, status: r2.status, location: loc };
  return { ok: true, lessonId, status: r2.status, location: loc };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const hrefLessons = (LESSONS || [])
    .filter((l) => l && typeof l === "object")
    .map((l) => ({ id: l.id, href: l.href }))
    .filter((l) => typeof l.id === "string" && l.id.length > 0 && typeof l.href === "string" && l.href.length > 0);

  const ids = hrefLessons.map((l) => l.id);
  const selected = ids.slice(0, args.count);

  console.log(`hrefLessons=${ids.length}`);
  console.log(`mvpSelected(count=${args.count})=${selected.length}`);
  for (const id of selected) console.log(`- ${id}`);

  if (args.write) {
    const outPath = path.join(repoRoot, "apps/mobile/src/data/mvp_lessons.json");
    ensureDir(path.dirname(outPath));
    fs.writeFileSync(outPath, JSON.stringify(selected, null, 2), "utf-8");
    console.log(`\nWrote: ${path.relative(repoRoot, outPath)}`);
  }

  if (args.verifyBase) {
    console.log(`\nVerifying against: ${args.verifyBase}`);
    let ok = 0;
    for (const id of selected) {
      // eslint-disable-next-line no-await-in-loop
      const r = await verifyOne(args.verifyBase, id);
      if (r.ok) ok += 1;
      else console.error(`[FAIL] ${id} status=${r.status} location=${r.location}`);
    }
    console.log(`verify: ${ok}/${selected.length} OK`);
    if (ok !== selected.length) process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

