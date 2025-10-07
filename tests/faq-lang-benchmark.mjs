// /tests/faq-lang-benchmark.mjs
// Full FAQ språkbenchmark med progressbar och Google Sheets export
// Kör: node tests/faq-lang-benchmark.mjs

import "../lib/load-env.js";
import fs from "fs";
import path from "path";
import chalk from "chalk";
import { detectLangCore } from "../lib/detect-lang-core.js";
import { loadAllFAQSheets, writeBenchmarkResult } from "../lib/faq-sheets.js";
import { createProgressBar } from "../lib/utils-progress.js";

const LOG_DIR = "./tests/logs";
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const timestamp = new Date().toISOString().split("T")[0];
const jsonOut = path.join(LOG_DIR, `faq-lang-benchmark-${timestamp}.json`);
const csvOut = path.join(LOG_DIR, `faq-lang-benchmark-${timestamp}.csv`);

const summary = {};
const allResults = [];

console.log(chalk.bold("\n🧩 FAQ Language Benchmark – DetectLangCore\n"));

// 1️⃣ Ladda alla FAQ-flikar (SE, EN, DA, DE)
const faqData = await loadAllFAQSheets();
const langs = Object.keys(faqData);
console.log(chalk.gray(`→ Hittade språk: ${langs.join(", ")}`));

// 2️⃣ Loopa per språk
for (const lang of langs) {
  const entries = faqData[lang] || [];
  const total = entries.length;
  const bar = createProgressBar(total, lang);

  let pass = 0;
  let fail = 0;
  let partial = 0;

  for (const row of entries) {
    const input = row.question || row.Q || "";
    const expected = lang;
    const result = await detectLangCore(input);

    const status =
      result.lang === expected
        ? "PASS"
        : result.lang === "UNKNOWN"
        ? "PARTIAL"
        : "FAIL";

    if (status === "PASS") pass++;
    else if (status === "FAIL") fail++;
    else partial++;

    allResults.push({
      expected,
      input,
      detected: result.lang,
      confidence: result.confidence ?? 0,
      via: result.via,
      status,
    });

    // Skicka till Google Sheet
    await writeBenchmarkResult({
      sheetName: "TEST_TORTURE",
      lang,
      question: input,
      detectedLang: result.lang,
      confidence: result.confidence ?? 0,
      result: status,
      timestamp: new Date().toISOString(),
    });

    bar.tick();
  }

  summary[lang] = { pass, fail, partial, total };
  console.log(
    chalk.green(
      `\n✅ ${lang}: ${pass} PASS / ${fail} FAIL / ${partial} PARTIAL (${total})`
    )
  );
}

// 3️⃣ Spara loggar lokalt
fs.writeFileSync(jsonOut, JSON.stringify(allResults, null, 2));
fs.writeFileSync(
  csvOut,
  "expected,input,detected,confidence,via,status\n" +
    allResults
      .map(
        (r) =>
          `${r.expected},"${r.input.replace(/"/g, '""')}",${r.detected},${r.confidence},${r.via},${r.status}`
      )
      .join("\n")
);

// 4️⃣ Skriv sammanfattning
console.log("\n--------------------------------------------------------");
console.log(chalk.bold("📊 Lang Benchmark Summary"));
console.log("--------------------------------------------------------");
for (const [lang, s] of Object.entries(summary)) {
  const acc = ((s.pass / s.total) * 100).toFixed(2);
  console.log(
    `${lang}: ${s.total} tests → ${s.pass} PASS / ${s.fail} FAIL / ${s.partial} PARTIAL (${acc}%)`
  );
}
console.log("--------------------------------------------------------");
console.log(
  chalk.green(`✅ Written to: TEST_TORTURE (Google Sheets) & ${csvOut}\n`)
);
