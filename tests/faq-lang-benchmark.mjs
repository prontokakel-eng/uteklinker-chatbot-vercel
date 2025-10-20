// /tests/faq-lang-benchmark.mjs
// Full FAQ språkbenchmark med progressbar och Google Sheets export
// Kör: node tests/faq-lang-benchmark.mjs

import "../lib/load-env.js";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { detectLangCore } from "../lib/detect-lang-core.js";
import { loadAllFAQSheets, queueBenchmarkResult, flushPendingWrites } from "../lib/faq-sheets.js";
import { createProgressBar } from "../lib/utils-progress.js";

// === TEST_MODE styr AI-användning ===
const TEST_MODE = process.env.TEST_MODE === "true";
console.log(TEST_MODE
  ? chalk.yellow("🧩 TEST_MODE = true → AI fallback DISABLED")
  : chalk.green("🧩 TEST_MODE = false → AI fallback ENABLED")
);

// === Benchmark ===
const sheetName = process.env.SHEET_TAB_NAME || "TEST_TORTURE";
const outputDir = path.join(process.cwd(), "tests", "logs");
if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });
const csvPath = path.join(outputDir, `faq-lang-benchmark-${new Date().toISOString().split("T")[0]}.csv`);

// === Init ===
console.log("\n🧩 FAQ Language Benchmark – DetectLangCore\n");
const allSheets = await loadAllFAQSheets();

// 🧩 Robust progress-init — stödjer både funktion & objekt
const progressInstance = createProgressBar(238 * 4);
const progress =
  typeof progressInstance === "function"
    ? { update: progressInstance }
    : progressInstance;

let results = [];
for (const lang of Object.keys(allSheets)) {
  const rows = allSheets[lang];
  console.log(chalk.cyan(`\n🌍 Testing ${lang} (${rows.length} rows)`));
  let pass = 0;

  for (let i = 0; i < rows.length; i++) {
    const { question } = rows[i];
    const result = await detectLangCore(question, { skipAI: TEST_MODE });

    const isPass = result.lang === lang;
    if (isPass) pass++;

    results.push({
      lang,
      question,
      detectedLang: result.lang,
      confidence: result.confidence,
      via: result.via,
      status: isPass ? "PASS" : "FAIL"
    });

    // logga till Google queue (asynkront)
    await queueBenchmarkResult({
      sheetName,
      lang,
      question,
      detectedLang: result.lang,
      confidence: result.confidence,
      result: isPass ? "PASS" : "FAIL",
      timestamp: new Date().toISOString(),
    });

    // 🧩 Skydda mot undefined progress.update
    if (progress?.update) {
      progress.update(i + 1 + 238 * (["SE", "EN", "DA", "DE"].indexOf(lang)));
    }
  }

  console.log(
    chalk.bold(
      `✅ ${lang}: ${pass} PASS / ${rows.length - pass} FAIL / 0 PARTIAL (${rows.length})`
    )
  );
}

// === Resultat ===
console.log("\n--------------------------------------------------------");
console.log("📊 Lang Benchmark Summary");
console.log("--------------------------------------------------------");

const summary = Object.entries(
  results.reduce((acc, r) => {
    acc[r.lang] = acc[r.lang] || { total: 0, pass: 0 };
    acc[r.lang].total++;
    if (r.status === "PASS") acc[r.lang].pass++;
    return acc;
  }, {})
).map(([lang, { total, pass }]) => {
  const pct = ((pass / total) * 100).toFixed(2);
  console.log(`${lang}: ${total} tests → ${pass} PASS / ${total - pass} FAIL / 0 PARTIAL (${pct}%)`);
  return { lang, pass, total, pct };
});

// === Skriv CSV ===
const header = "lang,question,detectedLang,confidence,via,status\n";
const csv = header + results.map(r =>
  `${r.lang},"${r.question.replace(/"/g, '""')}",${r.detectedLang},${r.confidence},${r.via},${r.status}`
).join("\n");

try {
  fs.writeFileSync(csvPath, csv, "utf8");
  console.log(chalk.green(`✅ Benchmark results saved to ${csvPath}`));
} catch (err) {
  console.error(chalk.red(`❌ Failed to write CSV: ${err.message}`));
}

// === Skicka till Google Sheets (batch flush) ===
await flushPendingWrites(process.env.SHEET_ID_MAIN);
console.log(chalk.green("✅ Written to Google Sheets & local CSV\n"));
