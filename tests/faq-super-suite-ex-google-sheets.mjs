// tests/faq-super-suite-ex-google-sheets.mjs
import "../lib/load-env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import stringSimilarity from "string-similarity";
import { normalizeMessage } from "./../lib/utils.js";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logging
const LOG_DIR = path.join(__dirname, "../logs");
const LOG_FILE = path.join(LOG_DIR, "super-suite-mock.log");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Språk
const LANGS = ["SE", "EN", "DA", "DE"];

// Mockad FAQ-data (används om GCP-variabler saknas)
function getMockFaqCache() {
  return {
    SE: [
      { question: "Vad kostar frakt?", answer: "Frakten kostar 99 kr" },
      { question: "Hur lång är leveranstiden?", answer: "2-3 arbetsdagar" },
    ],
    EN: [
      { question: "What is the delivery time?", answer: "Delivery is 2-3 days" },
      { question: "How much is shipping?", answer: "Shipping costs €9" },
    ],
    DA: [
      { question: "Hvad er leveringstid?", answer: "Levering er 2-3 dage" },
      { question: "Hvad koster fragt?", answer: "Fragt koster 99 DKK" },
    ],
    DE: [
      { question: "Wie lange ist die Lieferzeit?", answer: "Lieferung 2-3 Tage" },
      { question: "Was kostet der Versand?", answer: "Versand kostet 9 €" },
    ],
  };
}

// Pick N per språk
function pickNPerLang(FAQ_CACHE, n = 2) {
  const items = [];
  for (const lang of LANGS) {
    const list = FAQ_CACHE[lang] || [];
    if (list.length < n) throw new Error(`För få rader i FAQ_${lang}`);
    for (let i = 0; i < n; i++) {
      const row = list[i];
      items.push({
        lang,
        question: String(row.question || ""),
        answer: String(row.answer || ""),
      });
    }
  }
  return items;
}

// Logga test
function logChat(message, lang, source, reply) {
  const line =
    `[${new Date().toISOString()}] (lang=${lang}, source=${source})\n` +
    `Q: ${message}\n→ ${reply}\n\n`;
  fs.appendFileSync(LOG_FILE, line, "utf8");
}

// Main test
async function runSuperSuiteMock() {
  console.log("⚠️ Ingen Google Sheets → använder mockad FAQ-data");
  const FAQ_CACHE = getMockFaqCache();
  const items = pickNPerLang(FAQ_CACHE, 2);
  console.log(`✅ Valde ${items.length} frågor från mockad FAQ-data`);

  // Matcha fuzzy
  for (const it of items) {
    const questions = FAQ_CACHE[it.lang].map(f => normalizeMessage(f.question));
    const matches = stringSimilarity.findBestMatch(
      normalizeMessage(it.question),
      questions
    );
    const reply = FAQ_CACHE[it.lang][matches.bestMatchIndex].answer;
    logChat(it.question, it.lang, "FAQ", reply);
    if (!reply) throw new Error(`Ingen match för ${it.lang} :: ${it.question}`);
  }

  console.log("🟩 Alla mock-tester klara!");
}

// Run
runSuperSuiteMock().catch(err => {
  console.error("💥 Testfel:", err);
  process.exit(1);
});
