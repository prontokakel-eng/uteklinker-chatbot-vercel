#!/usr/bin/env node
// scripts/make-project-dossier.mjs
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { execSync } from "node:child_process";
import madge from "madge";

const ROOT = process.cwd();
const OUTDIR = path.join(ROOT, "logs", "reports", "project-dossier");
await fsp.mkdir(OUTDIR, { recursive: true });

function sha256(buf) {
  return crypto.createHash("sha256").update(buf).digest("hex");
}
function safeRead(p) {
  try { return fs.readFileSync(p); } catch { return null; }
}
function isText(p) {
  return /\.(m?[jt]sx?|c?m?js|json|ya?ml|md|txt|tsconfig|eslintrc|prettier)/i.test(p);
}
function listFiles(dir) {
  /** shallow-ish glob via manual walk (ignores node_modules/.git/.next/dist/coverage) */
  const skip = new Set(["node_modules", ".git", ".next", "dist", "coverage", ".vercel", "out"]);
  /** @type {string[]} */
  const files = [];
  const stack = [dir];
  while (stack.length) {
    const d = stack.pop();
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (skip.has(e.name)) continue;
      const full = path.join(d, e.name);
      if (e.isDirectory()) stack.push(full);
      else files.push(full);
    }
  }
  return files.sort();
}

// 1) Inventera filer
const files = listFiles(ROOT);

// 2) Bygg index (storlek, hash, första 3 rader för textfiler)
const index = [];
for (const f of files) {
  const rel = path.relative(ROOT, f);
  const stat = fs.statSync(f);
  const buf = safeRead(f) ?? Buffer.alloc(0);
  const entry = {
    file: rel,
    size: stat.size,
    mtime: stat.mtime.toISOString(),
    hash: sha256(buf),
    head: null
  };
  if (isText(rel)) {
    const head = buf.toString("utf8").split(/\r?\n/).slice(0, 3);
    entry.head = head;
  }
  index.push(entry);
}
await fsp.writeFile(path.join(OUTDIR, "files-index.json"), JSON.stringify(index, null, 2));

// 3) package.json, tsconfig.json, .knip.json (om finns)
for (const cfg of ["package.json", "tsconfig.json", "jsconfig.json", ".knip.json"]) {
  const p = path.join(ROOT, cfg);
  if (fs.existsSync(p)) {
    const raw = fs.readFileSync(p, "utf8");
    await fsp.writeFile(path.join(OUTDIR, cfg.replace(/\W+/g, "_")), raw);
  }
}

// 4) Modulgraf över källkod (begränsa till lib/** och api/** om de finns)
const graphTargets = [];
if (fs.existsSync(path.join(ROOT, "lib"))) graphTargets.push("lib");
if (fs.existsSync(path.join(ROOT, "api"))) graphTargets.push("api");
if (graphTargets.length === 0) graphTargets.push("."); // fallback

const madgeRes = await madge(graphTargets, {
  baseDir: ROOT,
  includeNpm: false,
  fileExtensions: ["js", "mjs", "cjs", "ts", "mts", "cts"],
  excludeRegExp: ["node_modules", "^\\.", "coverage", "dist", "_deprecated"]
});
await fsp.writeFile(
  path.join(OUTDIR, "module-graph.json"),
  JSON.stringify({
    circular: madgeRes.circular(),
    orphans: madgeRes.orphans(),
    dependencies: madgeRes.obj()
  }, null, 2)
);

// 5) Export/Import-karta (lättvikt: använd madge data + snabb parsning)
function roughExports(content) {
  const out = new Set();
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    let m;
    if ((m = line.match(/export\s+(?:const|let|var|function|class)\s+([A-Za-z0-9_]+)/))) out.add(m[1]);
    if ((m = line.match(/export\s*{\s*([^}]+)\s*}/))) {
      m[1].split(",").map(s=>s.trim().split(/\s+as\s+/)[1]||s.trim()).forEach(n=>n && out.add(n));
    }
    if (/\bexport\s+default\b/.test(line)) out.add("default");
  }
  return [...out];
}
const exportMap = {};
for (const f of files) {
  if (!/\.(m?[jt]s|c?m?js|jsx?)$/i.test(f)) continue;
  if (f.includes("node_modules") || f.includes("/dist/") || f.includes("\\dist\\")) continue;
  const rel = path.relative(ROOT, f);
  const raw = safeRead(f)?.toString("utf8");
  if (!raw) continue;
  exportMap[rel] = roughExports(raw);
}
await fsp.writeFile(path.join(OUTDIR, "exports-map.json"), JSON.stringify(exportMap, null, 2));

// 6) (Valfritt) Kör knip/depcheck och spara ren output (om finns i scripts)
const logs = {};
function tryRun(name, cmd) {
  try {
    logs[name] = execSync(cmd, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (e) {
    logs[name] = (e?.stdout || "") + "\n" + (e?.stderr || "");
  }
}
if (fs.existsSync(path.join(ROOT, ".knip.json"))) tryRun("knip", "knip --production --config .knip.json");
tryRun("depcheck", "depcheck --skip-missing=true");

await fsp.writeFile(path.join(OUTDIR, "tool-outputs.txt"),
  Object.entries(logs).map(([k,v]) => `=== ${k} ===\n${v}\n`).join("\n"));

// 7) Sammanfattning
const summary = {
  generatedAt: new Date().toISOString(),
  root: ROOT,
  counts: {
    files: files.length,
    jsLike: files.filter(f => /\.(m?[jt]sx?|c?m?js)$/i.test(f)).length
  }
};
await fsp.writeFile(path.join(OUTDIR, "summary.json"), JSON.stringify(summary, null, 2));

console.log(`\n✅ Dossier klar i: ${OUTDIR}`);
console.log(`Tips (PowerShell): Compress-Archive -Path "${OUTDIR}\\*" -DestinationPath "${OUTDIR}.zip" -Force`);
