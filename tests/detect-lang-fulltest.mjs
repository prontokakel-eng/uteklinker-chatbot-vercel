// 🧩 detect-lang-fulltest.mjs
// Komplett test av språkdetektion: Gate → Filters → DetectLang (Rules + Heuristics + Core)

import { gateMessage } from "../lib/gate.js";
import { detectLangCore } from "../lib/detect-lang-core.js";
import { detectLangRulesOnly } from "../lib/detect-lang-rules.js";
import { detectLangHeuristicGroup } from "../lib/detect-lang-heuristics.js";
import chalk from "chalk";

const tests = [
  { text: "Ja", expected: "SE" },
  { text: "Hej", expected: "SE" },
  { text: "Hej, hur mår du?", expected: "SE" },
  { text: "Varför är klinkerdäck dyra?", expected: "SE" },
  { text: "Hvordan har du det i dag?", expected: "DA" },
  { text: "Hvilken klinker passer bedst?", expected: "DA" },
  { text: "Tak", expected: "DA" },
  { text: "Muss ich die Fliesen gegen Frost schützen?", expected: "DE" },
  { text: "Welche Fliesen sind am besten?", expected: "DE" },
  { text: "Danke", expected: "DE" },
  { text: "How are you doing today?", expected: "EN" },
  { text: "Hi", expected: "EN" },
  { text: "Ok", expected: "EN" },
  { text: "Hej, how are you?", expected: "EN" },
  { text: "Why are tiles so expensive?", expected: "EN" },
  { text: "asdfghjkl", expected: "UNKNOWN" },
  { text: "1234567890", expected: "UNKNOWN" },
  { text: "?", expected: "UNKNOWN" },
];

console.log(chalk.bold("\n🧩 Fullständig språkdetektion – Gate → DetectLang"));
console.log("--------------------------------------------------------\n");

let failCount = 0;

for (const sample of tests) {
  const { text, expected } = sample;

  // Steg 1: Gate
  const gateRes = await gateMessage(text, "127.0.0.1");

  // Steg 2: Om Gate inte hanterade
  let coreRes = null;
  if (!gateRes?.handled) {
    coreRes = await detectLangCore(text, { skipAI: true });
  }

  // Utvärdera resultat
  const resultLang = gateRes?.lang || coreRes?.lang || "UNKNOWN";
  const resultVia = gateRes?.via || coreRes?.via || "none";

  const pass = resultLang === expected || (expected === "UNKNOWN" && resultLang === "UNKNOWN");
  const status = pass
    ? chalk.green("PASS")
    : resultLang === "UNKNOWN" && expected !== "UNKNOWN"
    ? chalk.yellow("PARTIAL")
    : chalk.red("FAIL");

  console.log(chalk.white.bold(`🧠 "${text}"`));
  console.log(`   Expected: ${expected}`);
  console.log(`   Gate: ${gateRes?.lang || "—"} (via=${gateRes?.via || "—"}, handled=${!!gateRes?.handled})`);
  if (coreRes) {
    console.log(`   Core: ${coreRes.lang} (via=${coreRes.via}, conf=${coreRes.confidence})`);
  } else {
    console.log(`   Core: — (skipped)`);
  }
  console.log(`   → ${status}\n`);

  if (!pass) failCount++;
}

console.log(chalk.bold("--------------------------------------------------------"));
console.log(
  chalk.bold(`📊 Sammanfattning: ${tests.length - failCount} PASS / ${failCount} FAIL`)
);
console.log(chalk.bold("--------------------------------------------------------\n"));
console.log(chalk.gray("Tips: Kör med 'node detect-lang-fulltest.mjs'"));
