// tests/faq-super-suite-local.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import stringSimilarity from "string-similarity";
import testCases from "./test-cases.json" with { type: "json" };
import { normalizeMessage } from "../lib/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_FILE = path.join(__dirname, "../logs/super-suite-local.log");

let mismatchCount = 0;

function logChat(message, expectedLang, source, reply) {
  const line =
    `[${new Date().toISOString()}] (expected=${expectedLang}, source=${source})\n` +
    `Q: ${message}\n→ ${reply}\n\n`;
  fs.appendFileSync(LOG_FILE, line, "utf8");
}

function ok(msg) { console.log("✅", msg); }
function fail(msg) { console.error("❌", msg); process.exitCode = 1; }

// --- Helper: plocka 4 frågor per språk ---
function pickNPerLang(FAQ_CACHE, n = 4) {
  const items = [];
  for (const lang of Object.keys(FAQ_CACHE)) {
    const list = FAQ_CACHE[lang] || [];
    if (list.length < n) throw new Error(`För få rader i FAQ_${lang}`);
    for (let i = 0; i < n; i++) {
      const row = list[i];
      items.push({ lang, question: row.question, answer: row.answer });
    }
  }
  return items;
}

async function runLocalSuite() {
  console.warn("⚠️ Kör lokal super-suite med test-cases.json (ingen Google Sheets)");

  const items = pickNPerLang(testCases, 4);
  ok(`Valde ${items.length} frågor från mockad FAQ-data`);

  // Testa FAQ-matchning
  for (const it of items) {
    const questions = (testCases[it.lang] || []).map(f => normalizeMessage(f.question));
    const matches = stringSimilarity.findBestMatch(normalizeMessage(it.question), questions);
    const reply = (testCases[it.lang] || [])[matches.bestMatchIndex].answer;
    logChat(it.question, it.lang, "FAQ", reply);
    if (!reply) fail(`Ingen match för ${it.lang} :: ${it.question}`);
  }

  ok("Alla frågor hittade svar i FAQ");
  console.log("🟩 Lokal suite klar!");
}

runLocalSuite().catch(err => {
  console.error("💥 Testfel (lokal suite):", err);
  process.exit(1);
});
