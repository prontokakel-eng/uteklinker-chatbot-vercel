// /tests/chatBot-torture-test-v2.mjs
import "../lib/load-env.js";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import stringSimilarity from "string-similarity";
import { detectLangSafe } from "../lib/detect-lang.js";
import { loadAllFaqData } from "../lib/utils.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(__dirname, "../logs");
const LOG_FILE = path.join(LOG_DIR, "torture-v2.log");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LANGS = ["SE", "EN", "DA", "DE"];
let mismatchCount = 0;

// === Init OpenAI client ===
const apiKey = process.env.OPENAI_API_KEY;
const projectId = process.env.OPENAI_PROJECT_ID;
const openai = new OpenAI({
  apiKey,
  defaultHeaders: { "OpenAI-Project": projectId }
});

function log(msg) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${msg}\n`, "utf8");
}

function normalizeMessage(msg) {
  return String(msg || "")
    .toLowerCase()
    .replace(/[.,!?;:()"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function ok(msg) {
  console.log("✅", msg);
}
function fail(msg) {
  console.error("❌", msg);
  process.exitCode = 1;
}

// --- Torture categories ---
const TESTS = {
  FUZZY: [
    { input: "Kan jag få leveras till dörrn?", expected: "SE" },
    { input: "Wie lange dauert die liefrung?", expected: "DE" },
    { input: "hvornår er leverngstid?", expected: "DA" },
    { input: "whats the delivry time?", expected: "EN" }
  ],
  GIBBERISH: [
    { input: "asdkljasdkljasdkljasd", type: "GIBBERISH" },
    { input: "!!! ??? ###", type: "GIBBERISH" }
  ],
  LONG: [
    { input: "lorem ipsum ".repeat(30), type: "LONG" }
  ],
  BLOCK: [
    { input: "free money scam offer", type: "BLOCK" }
  ]
};

async function runTorture() {
  console.log("🧪 Kör Torture v2...");

  const FAQ_CACHE = await loadAllFaqData();

  // Step 1 – FAQ match basic sanity
  for (const lang of LANGS) {
    const list = FAQ_CACHE[lang] || [];
    if (!list.length) continue;
    const q = list[0].question;
    const a = list[0].answer;
    const questions = list.map(f => normalizeMessage(f.question));
    const matches = stringSimilarity.findBestMatch(normalizeMessage(q), questions);
    const reply = list[matches.bestMatchIndex]?.answer;
    if (!reply) fail(`FAQ misslyckades för ${lang}`);
    log(`[FAQ] ${lang} Q="${q}" → ${reply}`);
  }
  ok("FAQ baseline funkar");

  // Step 2 – Fuzzy
  for (const it of TESTS.FUZZY) {
    const res = await detectLangSafe(it.input, "torture-fuzzy", { skipRateLimit: true });
    log(`[FUZZY] Input="${it.input}" → ${JSON.stringify(res)}`);
    if (res.lang !== it.expected) {
      fail(`FUZZY mismatch: ${it.input} → ${res.lang} (expected ${it.expected})`);
      mismatchCount++;
    }
  }
  ok("FUZZY-tester klara");

  // Step 3 – FILTER tests
  const filters = [...TESTS.GIBBERISH, ...TESTS.LONG, ...TESTS.BLOCK];
  for (const it of filters) {
    const res = await detectLangSafe(it.input, "torture-filter", { skipRateLimit: true });
    log(`[${it.type}] Input="${it.input}" → ${JSON.stringify(res)}`);
    if (res.lang !== "FILTER") {
      fail(`${it.type} misslyckades: ${it.input} → ${JSON.stringify(res)}`);
      mismatchCount++;
    }
  }
  ok("FILTER (GIBBERISH/LONG/BLOCK) tester klara");

  console.log("🟩 Torture v2 klart. Totala mismatchar:", mismatchCount);
}

runTorture().catch(err => {
  console.error("💥 Torture v2 error:", err);
  process.exit(1);
});
