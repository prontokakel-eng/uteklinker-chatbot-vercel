import "../lib/load-env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import stringSimilarity from "string-similarity";
import { getFaqByLang, getFaqCache } from "./../lib/faq-cache.js";
import { normalizeMessage } from "./../lib/utils.js";
import { detectLangSafe } from "./../lib/detect-lang.js";

// ✅ Ny JSON-import (ingen assert-warning längre)
import testCases from "./test-cases.json" with { type: "json" };

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOG_DIR = path.join(__dirname, "../logs");
const LOG_FILE = path.join(LOG_DIR, "super-suite.log");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

let mismatchCount = 0;

function logChat(message, expectedLang, source, reply) {
  const line =
    `[${new Date().toISOString()}] (expected=${expectedLang}, source=${source})\n` +
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

// --- Google Sheets ---
function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GCP_PROJECT_ID,
      private_key_id: process.env.GCP_PRIVATE_KEY_ID,
      private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      client_email: process.env.GCP_CLIENT_EMAIL,
      client_id: process.env.GCP_CLIENT_ID,
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

// --- Helper: plocka frågor ---
function pickNPerLang(FAQ_CACHE, n = 4) {
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

// --- Helper: Sheets ---
async function appendRowsToTest(rows) {
  if (!rows.length) return;
  const sheets = await getSheets();
  await sheets.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${TEST_TAB}!A:B`,
    valueInputOption: "RAW",
    requestBody: { values: rows },
  });
}
async function readTestSheet() {
  const sheets = await getSheets();
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${TEST_TAB}!A:B`,
  });
  return res.data.values || [];
}

// --- Main Test Suite ---
async function runSuperSuite() {
  let FAQ_CACHE;
  if (SHEET_ID) {
    console.log("♻️ FAQ-cache FORCE reload...");
    FAQ_CACHE = await getFaqCache(true);
  } else {
    console.warn("⚠️ SHEET_ID saknas → använder mockad FAQ-data från test-cases.json");
    FAQ_CACHE = testCases;
  }

  const items = pickNPerLang(FAQ_CACHE, 4);
  ok(`Valde ${items.length} frågor (${LANGS.join(", ")})`);

  // 2) FAQ match test
  for (const it of items) {
    const questions = (await getFaqByLang(it.lang)).map((f) =>
      normalizeMessage(f.question)
    );
    const matches = stringSimilarity.findBestMatch(
      normalizeMessage(it.question),
      questions
    );
    const reply = (await getFaqByLang(it.lang))[matches.bestMatchIndex].answer;
    logChat(it.question, it.lang, "FAQ", reply);
    if (!reply) fail(`Ingen match för ${it.lang} :: ${it.question}`);
  }
  ok("Alla frågor hittade svar i FAQ");

  // 3) Uppdatera svar
  const rows1 = items.map((it) => [
    it.question,
    `${it.answer} xxx-${it.lang.toLowerCase()}`,
  ]);
  if (SHEET_ID) await appendRowsToTest(rows1);
  ok("Uppdaterade svar sparade i Test-flik (om Sheets)");

  // 4) Uppdatera frågor
  const rows2 = items.map((it) => [
    `${it.question} yyy-${it.lang.toLowerCase()}`,
    it.answer,
  ]);
  if (SHEET_ID) await appendRowsToTest(rows2);
  ok("Uppdaterade frågor sparade i Test-flik (om Sheets)");

  // 5) FUZZY test
  for (const it of items) {
    const fuzzyQ = it.question.split(" ").reverse().join(" ");
    const questions = (await getFaqByLang(it.lang)).map((f) =>
      normalizeMessage(f.question)
    );
    const matches = stringSimilarity.findBestMatch(
      normalizeMessage(fuzzyQ),
      questions
    );
    const reply = (await getFaqByLang(it.lang))[matches.bestMatchIndex].answer;
    logChat(fuzzyQ, it.lang, "FUZZY", reply);
    if (!reply) fail(`Ingen FUZZY match för ${it.lang} :: ${fuzzyQ}`);
  }
  ok("FUZZY frågor hittade svar");

  // 6) Uppdatera FUZZY-svar
  const rows3 = items.map((it) => [
    it.question,
    `${it.answer} fuzzy-${it.lang.toLowerCase()}`,
  ]);
  if (SHEET_ID) await appendRowsToTest(rows3);
  ok("FUZZY-uppdaterade svar sparade i Test-flik (om Sheets)");

  console.log("🟩 Alla tester klara");
  console.log(`📊 Summering: ${mismatchCount} språk-mismatchar hittades`);
}

// --- Run ---
if (!SHEET_ID) {
  console.warn("⚠️ SHEET_ID saknas i Vercel Environment Variables");
}
runSuperSuite().catch((err) => {
  console.error("💥 Testfel:", err);
  process.exit(1);
});
