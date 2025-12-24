/* eslint-disable no-console */
const fs = require("node:fs");
const path = require("node:path");

// Register ts-node from apps/web so we can require TS constants.
process.env.TS_NODE_TRANSPILE_ONLY = "1";
process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
});
const tsNodeRegisterPath = require.resolve("ts-node/register/transpile-only", {
  paths: [path.resolve(__dirname, "../apps/web")],
});
require(tsNodeRegisterPath);

const { LESSONS } = require("../apps/web/src/constants");

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function main() {
  const repoRoot = path.resolve(__dirname, "..");
  const lessons = (LESSONS || [])
    .filter((l) => l && typeof l === "object")
    .map((l) => ({
      id: l.id,
      title: l.title,
      description: l.description || "",
      category: l.category || "unknown",
      status: l.status || "available",
      order: typeof l.order === "number" ? l.order : 9999,
      href: l.href || null,
      prerequisites: Array.isArray(l.prerequisites) ? l.prerequisites : [],
      stars: typeof l.stars === "number" ? l.stars : 0,
    }))
    // Mobile MVP only supports launching lessons with href.
    .filter((l) => typeof l.href === "string" && l.href.length > 0)
    .sort((a, b) => a.order - b.order);

  const out = { version: 1, lessons };

  const outWebPublic = path.join(repoRoot, "apps/web/public/roadmap.json");
  ensureDir(path.dirname(outWebPublic));
  fs.writeFileSync(outWebPublic, JSON.stringify(out, null, 2), "utf-8");

  const outMobile = path.join(repoRoot, "apps/mobile/src/data/roadmap.json");
  ensureDir(path.dirname(outMobile));
  fs.writeFileSync(outMobile, JSON.stringify(out, null, 2), "utf-8");

  console.log(`export-roadmap-json: OK lessons=${lessons.length}`);
  console.log(`  -> ${path.relative(repoRoot, outWebPublic)}`);
  console.log(`  -> ${path.relative(repoRoot, outMobile)}`);
}

main();


