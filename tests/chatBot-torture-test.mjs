// /tests/chatBot-torture-test.mjs
import "../lib/load-env.js";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import stringSimilarity from "string-similarity";
import { detectLangSafe } from "../lib/detect-lang.js";
import { loadAllFaqData } from "../lib/utils.js";
import testCasesRaw from "./test-cases.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "../logs");
const LOG_FILE = path.join(LOG_DIR, "chatBot-torture-test.log");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LANGS = ["SE", "EN", "DA", "DE"];
let mismatchCount = 0;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: { "OpenAI-Project": process.env.OPENAI_PROJECT_ID }
});

function log(msg) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`, "utf8");
  console.log(msg);
}

// === Helpers ===
function normalizeMessage(m) {
  return String(m || "").toLowerCase().replace(/[.,!?;:()"]/g, "").replace(/\s+/g, " ").trim();
}
function shuffleWords(s) {
  return s.split(" ").sort(() => Math.random() - 0.5).join(" ");
}
function introduceTypos(s) {
  return s.replace(/a/g, "aa").replace(/o/g, "oo").replace(/k/g, "kk");
}

// === Main ===
async function runSuite() {
  let FAQ_CACHE;
  if (process.env.SHEET_ID) {
    log("✅ SHEET_ID hittad – laddar FAQ från Google Sheets");
    FAQ_CACHE = await loadAllFaqData();
  } else {
    log("⚠️ SHEET_ID saknas – använder test-cases.json");
    FAQ_CACHE = testCasesRaw;
  }

  for (const lang of LANGS) {
    const list = FAQ_CACHE[lang] || [];
    if (!list.length) continue;

    for (const row of list.slice(0, 3)) {
      const origQ = row.question;
      const variants = [
        origQ,
        shuffleWords(origQ),
        introduceTypos(origQ)
      ];

      for (const v of variants) {
        const normQuestions = list.map(f => normalizeMessage(f.question));
        const matches = stringSimilarity.findBestMatch(normalizeMessage(v), normQuestions);
        const reply = list[matches.bestMatchIndex]?.answer;
        const { lang: detected, via } = await detectLangSafe(v, "torture", { skipRateLimit: true });

        log(`Lang=${lang} Detected=${detected} via=${via} | Q="${v}" → ${reply ? "✅ HIT" : "❌ MISS"}`);
        if (!reply) mismatchCount++;
      }
    }
  }

  // Extra AI fallback
  const aiQ = "Berätta något om klinkerplattor i vinterklimat";
  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "Du är en FAQ-bot" },
      { role: "user", content: aiQ }
    ],
    max_tokens: 50
  });
  log("AI fallback test → " + (resp.choices[0]?.message?.content?.trim() || "(no reply)"));

  log(`🟩 Torture-test klart. Totala mismatchar: ${mismatchCount}`);
}

runSuite().catch(e => {
  console.error("💥 Torture-test fail:", e);
  log("💥 Torture-test fail: " + e.message);
});
