import "../lib/load-env.js";
// /tests/faq-fuzzy-suite.mjs
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import stringSimilarity from "string-similarity";
import { getFaqByLang, getFaqCache } from "./../lib/faq-cache.js";
import { normalizeMessage } from "./../lib/utils.js";
import { detectLangLocal } from "./../lib/detect-lang.js"; // ✅ rätt
// --- Loggfunktion ---
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "../logs");
const LOG_FILE = path.join(LOG_DIR, "dev-chat.log");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
let mismatchCount = 0; // ✅ global räknare
function logChat(message, expectedLang, source, reply) {
  const detected = detectLangLocal(message, expectedLang);
  const line =
    `[${new Date().toISOString()}] (expected=${expectedLang}, detected=${detected.lang}/${detected.method}, source=${source})\n` +
    `Q: ${message}\n→ ${reply}\n\n`;
  // ✅ full logg alltid i dev-chat.log
  fs.appendFileSync(LOG_FILE, line, "utf8");
  if (expectedLang !== detected.lang) {
    mismatchCount++; // ✅ öka räknaren
    fs.appendFileSync(LANG_LOG_FILE, line, "utf8"); // ✅ endast mismatchar i lang-detect.log
    console.warn(
      `⚠️ Språk-mismatch: expected=${expectedLang}, detected=${detected.lang} (${detected.method}) for Q="${message}"`
    );
  }
}
function ok(msg) { console.log("✅", msg); }
function fail(msg) { console.error("❌", msg); process.exitCode = 1; }
// --- Google Sheets helpers ---
function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GCP_PROJECT_ID,
      private_key_id: process.env.GCP_PRIVATE_KEY_ID,
      private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.GCP_CLIENT_EMAIL,
      client_id: process.env.GCP_CLIENT_ID,
      sheet_id: process.env.SHEET_ID,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}
async function getSheets() {
  const auth = await getAuth();
  return google.sheets({ version: "v4", auth });
}
const SHEET_ID = process.env.SHEET_ID;
const TEST_TAB = "Test";
const LANGS = ["SE", "EN", "DA", "DE"];
function pickNPerLang(FAQ_CACHE, n = 4) {
  const items = [];
  for (const lang of LANGS) {
    const list = FAQ_CACHE[lang] || [];
    console.log(`🔎 pickNPerLang: ${lang} -> ${list.length} frågor i cache`);
    if (!list || list.length < n) throw new Error(`För få rader i FAQ_${lang}`);
    for (let i = 0; i < n; i++) {
      const row = list[i];
      items.push({ lang, question: String(row.question || ""), answer: String(row.answer || "") });
    }
  }
  return items;
}
async function appendRowsToTest(rows) {
  if (!rows.length) return;
  console.log("📝 APPEND →", rows.length, "rader till Test!A:B");
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TEST_TAB}!A:B`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}
async function runExactSuite() {
  const FAQ_CACHE = await getFaqCache(true);
  console.log("📚 FAQ laddad i runExactSuite");
  for (const lang of LANGS) {
    if (!FAQ_CACHE[lang] || FAQ_CACHE[lang].length === 0) {
      fail(`Cache saknar data för språk: ${lang}`);
    } else {
      console.log(`✅ Cache innehåller ${FAQ_CACHE[lang].length} frågor för ${lang}`);
    }
  }
  const items = pickNPerLang(FAQ_CACHE, 4);
  ok(`Valde ${items.length} frågor (${LANGS.join(", ")})`);
  const rows = [];
  for (const it of items) {
    const normQ = normalizeMessage(it.question);
    const questions = (await getFaqByLang(it.lang)).map(f => normalizeMessage(f.question));
    const matches = stringSimilarity.findBestMatch(normQ, questions);
    if (normQ !== questions[matches.bestMatchIndex]) {
      fail(`Ingen exakt match för ${it.lang} :: ${it.question}`);
    } else {
      const reply = (await getFaqByLang(it.lang))[matches.bestMatchIndex].answer;
      logChat(it.question, it.lang, "FAQ", reply);
      rows.push([it.question, reply]);
    }
  }
  await appendRowsToTest(rows);
  ok("Alla exakta frågor matchade sina svar och skrevs till Sheets");
}
async function runFuzzySuite() {
  const FAQ_CACHE = await getFaqCache(true);
  console.log("📚 FAQ laddad i runFuzzySuite");
  for (const lang of LANGS) {
    if (!FAQ_CACHE[lang] || FAQ_CACHE[lang].length === 0) {
      fail(`Cache saknar data för språk: ${lang}`);
    } else {
      console.log(`✅ Cache innehåller ${FAQ_CACHE[lang].length} frågor för ${lang}`);
    }
  }
  const items = pickNPerLang(FAQ_CACHE, 4);
  const rows = [];
  for (const it of items) {
    const questions = (await getFaqByLang(it.lang)).map(f => f.question);
    const matches = stringSimilarity.findBestMatch(normalizeMessage(it.question), questions);
    const reply = (await getFaqByLang(it.lang))[matches.bestMatchIndex].answer;
    logChat(it.question, it.lang, "FUZZY", reply);
    rows.push([it.question, reply]);
  }
  await appendRowsToTest(rows);
  ok("FUZZY-match loggad och skriven till Sheets");
}
async function main() {
  const mode = (process.argv[2] || "both").toLowerCase();
  if (!SHEET_ID) throw new Error("SHEET_ID saknas i .env.vercel");
  if (mode === "exact" || mode === "both") await runExactSuite();
  if (mode === "fuzzy" || mode === "both") await runFuzzySuite();
  console.log("🟩 Alla tester klara");
  console.log(`📊 Summering: ${mismatchCount} språk-mismatchar hittades`);
}
main().catch(err => {
  console.error("💥 Testfel:", err);
  process.exit(1);
});
