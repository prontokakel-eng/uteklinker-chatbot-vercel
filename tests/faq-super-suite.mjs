// /tests/faq-super-suite.mjs
import "../lib/load-env.js";  // 🔑 lägger in SHEET_ID i process.env
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import stringSimilarity from "string-similarity";
import testCasesRaw from "./test-cases.json" with { type: "json" };
import { detectLangSafe } from "../lib/detect-lang.js";
import { loadAllFaqData } from "../lib/utils.js";   // 👈 viktigt!

// --- Setup paths ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "../logs");
const LOG_FILE = path.join(LOG_DIR, "super-suite.log");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// --- Språk vi testar ---
const LANGS = ["SE", "EN", "DA", "DE"];
let mismatchCount = 0;

// --- Init OpenAI client ---
const apiKey = process.env.OPENAI_API_KEY || "";
const projectId = process.env.OPENAI_PROJECT_ID || "";

console.log("🔍 super-suite init | API-key length:", apiKey.length);
console.log("🔍 super-suite init | Project-ID:", projectId);
console.log(
  "🔑 super-suite | OPENAI_API_KEY (prefix/suffix):",
  apiKey.slice(0, 5), "...", apiKey.slice(-5)
);

// --- Initiera OpenAI med Project-header ---
const openai = new OpenAI({
  apiKey,
  defaultHeaders: {
    "OpenAI-Project": projectId
  }
});

// --- Selftest ---
(async () => {
  try {
    const models = await openai.models.list();
    const names = models.data.slice(0, 3).map(m => m.id).join(", ");
    console.log("✅ OpenAI selftest OK – modeller:", names);
  } catch (err) {
    console.error("❌ OpenAI selftest FAIL:", err.message);
  }
})();

// --- Normalize test cases ---
function normalizeTestCases(raw) {
  const grouped = {};
  for (const lang of LANGS) grouped[lang] = raw[lang] || [];
  grouped.FUZZY = raw.FUZZY || [];
  grouped.GIBBERISH = raw.GIBBERISH || [];
  grouped.LONG = raw.LONG || [];
  grouped.BLOCK = raw.BLOCK || [];
  return grouped;
}
const testCases = normalizeTestCases(testCasesRaw);

// --- Helpers ---
function normalizeMessage(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/[.,!?;:()"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function logChat(message, expected, source, reply) {
  const line =
    `[${new Date().toISOString()}] (expected=${expected}, source=${source})\n` +
    `Q: ${message}\n→ ${reply}\n\n`;
  fs.appendFileSync(LOG_FILE, line, "utf8");
}

function ok(msg) {
  console.log("✅", msg);
}
function fail(msg) {
  console.error("❌", msg);
  process.exitCode = 1;
}

// --- Pick N per lang ---
function pickNPerLang(FAQ_CACHE, n = 4) {
  const items = [];
  for (const lang of LANGS) {
    const list = FAQ_CACHE[lang] || [];
    if (list.length < n) {
      console.warn(`⚠️ Endast ${list.length} rader i FAQ_${lang}, tar alla`);
      n = list.length;
    }
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

// --- Main suite ---
async function runSuperSuite() {
  let FAQ_CACHE;
  let useLocalCases = false;

  if (process.env.SHEET_ID) {
    console.log("✅ SHEET_ID hittad → laddar från Google Sheets");
    FAQ_CACHE = await loadAllFaqData();
  } else {
    console.log("⚠️ SHEET_ID saknas → använder test-cases.json");
    FAQ_CACHE = testCases;
    useLocalCases = true;
  }

  const items = pickNPerLang(FAQ_CACHE, 4);
  ok(`Valde ${items.length} FAQ-frågor (${LANGS.join(", ")})`);

  // --- Step 1: FAQ match ---
  for (const it of items) {
    const questions = FAQ_CACHE[it.lang].map((f) => normalizeMessage(f.question));
    const matches = stringSimilarity.findBestMatch(
      normalizeMessage(it.question),
      questions
    );
    const reply = FAQ_CACHE[it.lang][matches.bestMatchIndex]?.answer;
    logChat(it.question, it.lang, "FAQ", reply);
    if (!reply) fail(`Ingen match för ${it.lang} :: ${it.question}`);
  }
  ok("Alla frågor hittade svar i FAQ");

  // --- Extended tests only if local test-cases.json används ---
  if (useLocalCases) {
    console.log("\n📝 Kör EXTENDED tester (FUZZY, GIBBERISH, LONG, BLOCK) från test-cases.json\n");

    // FUZZY
    for (const it of FAQ_CACHE.FUZZY) {
      const lang = it.expected;
      const questions = FAQ_CACHE[lang].map((f) => normalizeMessage(f.question));
      const matches = stringSimilarity.findBestMatch(normalizeMessage(it.input), questions);
      const reply = FAQ_CACHE[lang][matches.bestMatchIndex]?.answer;
      logChat(it.input, lang, "FUZZY", reply);
      if (!reply) fail(`Ingen FUZZY match för ${lang} :: ${it.input}`);
    }
    ok("FUZZY frågor hittade svar");

    // FILTER: GIBBERISH / LONG / BLOCK
    const filterTests = [
      ...(FAQ_CACHE.GIBBERISH || []).map((x) => ({ ...x, type: "GIBBERISH" })),
      ...(FAQ_CACHE.LONG || []).map((x) => ({ ...x, type: "LONG" })),
      ...(FAQ_CACHE.BLOCK || []).map((x) => ({ ...x, type: "BLOCK" }))
    ];

    for (const it of filterTests) {
      const result = await detectLangSafe(it.input, "super-suite", { skipRateLimit: true });
      logChat(it.input, "FILTER", it.type, JSON.stringify(result));
      if (result.lang !== "FILTER") {
        fail(`${it.type} misslyckades :: ${it.input} → ${JSON.stringify(result)}`);
      }
    }
    ok("FILTER-tester (GIBBERISH/LONG/BLOCK) godkända");
  } else {
    console.log("\nℹ️ Extended tester (FUZZY, GIBBERISH, LONG, BLOCK) hoppades över – körs endast med test-cases.json\n");
  }

  // --- Step 4: AI fallback ---
  const aiFallbackQ = "Vad tycker du om Star Wars?";
  console.log("🤖 Testar AI fallback med input:", aiFallbackQ);
  try {
    const resp = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: "Du är en FAQ-bot för test." },
        { role: "user", content: aiFallbackQ }
      ],
      max_tokens: 50
    });
    const reply = resp.choices[0]?.message?.content?.trim();
    logChat(aiFallbackQ, "AI", "AI-fallback", reply);
    if (!reply) fail("AI fallback misslyckades – inget svar");
    else ok("AI fallback returnerade svar");
  } catch (err) {
    fail(`AI fallback fel: ${err.message}`);
  }

  console.log("🟩 Alla tester klara");
  console.log(`📊 Summering: ${mismatchCount} språk-mismatchar hittades`);
}

// --- Run ---
runSuperSuite().catch((err) => {
  console.error("💥 Testfel (super-suite):", err);
  process.exit(1);
});
