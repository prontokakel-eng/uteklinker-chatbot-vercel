#!/usr/bin/env node
import fsp from "node:fs/promises";
import path from "node:path";

const pct = (num, denom) => (denom ? (num / denom) * 100 : 0);

// Helper
const p95 = arr => arr.length ? [...arr].sort((a,b)=>a-b)[Math.floor(arr.length*0.95)] : 0;

// --- MAIN ---
(async () => {
  const file = path.resolve("./reports/torture-report.json");
  const raw = await fsp.readFile(file, "utf8").catch(() => null);
  if (!raw) return console.error("❌  Hittar inte reports/torture-report.json");
  const data = JSON.parse(raw);
  const { results = [], summary = {} } = data;

  const total = results.length;
  const pass = results.filter(r => r.status === "pass").length;
  const fail = total - pass;

  console.log("🧩  Analyzing torture-report:", file);
  console.log("──────────────────────────────────────────────");
  console.log(`Total: ${total} | ✅ Pass: ${pass} | ❌ Fail: ${fail} | OK: ${pct(pass,total).toFixed(1)}%`);

  // --- MATRIX calculation ---
  const matrix = {}; // lang → category → { total, pass, fail, blocked, ai }

  for (const r of results) {
    const L = (r.lang || "UNK").toUpperCase();
    const cat = (r.category || r.decision || "unknown").toLowerCase();
    matrix[L] ??= {};
    matrix[L][cat] ??= { total: 0, pass: 0, fail: 0, ai: 0, blocked: 0 };
    const m = matrix[L][cat];
    m.total++;
    if (r.status === "pass") m.pass++;
    else m.fail++;
    if (r.decision === "blocked") m.blocked++;
    if (r.ai?.used) m.ai++;
  }

  // --- LATENCY ---
  const lat = { gates: [], detect: [], lookup: [], ai: [], total: [] };
  for (const r of results)
    for (const k of Object.keys(lat))
      if (typeof r.latency?.[k] === "number") lat[k].push(r.latency[k]);

  const latency = {};
  for (const [k, arr] of Object.entries(lat))
    latency[k] = p95(arr);

  // --- BUILD export object ---
  const exportData = {
    timestamp: new Date().toISOString(),
    total, pass, fail,
    okRate: pct(pass,total).toFixed(2),
    aiMode: summary.aiMode,
    latencyP95: latency,
    matrix,
  };

  // --- SAVE MATRIX ---
  const outFile = path.resolve("./reports/lang-matrix.json");
  await fsp.writeFile(outFile, JSON.stringify(exportData, null, 2), "utf8");

  console.log(`✅  Matrix export klar → ${outFile}`);
  console.log("Språkvis precision:");
  for (const [L, cats] of Object.entries(matrix)) {
    const totals = Object.values(cats).reduce((a, c) => a + c.total, 0);
    const passes = Object.values(cats).reduce((a, c) => a + c.pass, 0);
    console.log(`  ${L.padEnd(3)}: ${pct(passes, totals).toFixed(1)}%  (${passes}/${totals})`);
  }

  console.log("\nP95-latens (ms):", latency);
})();
