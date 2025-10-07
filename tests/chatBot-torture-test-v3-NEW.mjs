import "../lib/load-env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";

import handler from "../api/chat.js";

import { detectLangRulesOnly } from "../lib/detect-lang-rules.js"; // PreDetect = rules only
import { detectLangSafe } from "../lib/detect-lang.js";           // 🔑 viktig
import wordLists from "../config/BL-WL-words-list.json" with { type: "json" };
import { chatPipeline } from "../lib/chatPipeline.js";

// 📝 Debug filnamn
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(`📝 Running script: ${__filename}`);

// 🆕 Läs in test-cases-fil (styrbar via env)
const CASES_FILE = process.env.TEST_CASES_FILE || "test-cases.json";
const casesPath = path.join(__dirname, CASES_FILE);
const testCases = JSON.parse(fs.readFileSync(casesPath, "utf8"));
console.log(`📂 Using test cases: ${casesPath}`);

const LANGS = ["SE", "EN", "DA", "DE"];
let mismatches = 0;
let preVsChatDiffs = 0;
const rows = [];
const stats = { regex: 0, anchors: 0, whitelist: 0, heuristic: 0, ai: 0, unknown: 0 };

// === Flag-emoji helper ===
function flagEmoji(code) {
  switch (code) {
    case "SE": return "🇸🇪 SE";
    case "EN": return "🇬🇧 EN";
    case "DA": return "🇩🇰 DA";
    case "DE": return "🇩🇪 DE";
    case "FILTER": return "🚫 FILTER";
    case "UNKNOWN": return "❓ UNKNOWN";
    default: return code || "-";
  }
}

// === Normalizer ===
function normalizeCase(it, defaultExpected) {
  if (typeof it === "string") {
    return { input: it, expected: defaultExpected };
  }
  return {
    input: it.input,
    expected: it.expected || defaultExpected,
  };
}

// === Local  (ingen HTTP, kör API handler) ===
async function runLocal(input, i = 0) {
  const req = {
    method: "POST",
    body: { text: input },
    headers: { "x-forwarded-for": `test-ip-${i}` },
  };
  let result;
  const res = {
    status(code) { this.code = code; return this; },
    json(obj) { result = obj; return obj; },
    setHeader() {}
  };
  await handler(req, res);

  // 🔑 Lägg till språkdetektion med fallback
  const detectRes = await detectLangSafe(input, "test");
  result.lang = detectRes.lang;
  result.via = detectRes.via;

  return result;
}

// === Mode selection ===
const MODE = process.env.TEST_MODE || "local";
const TAB_NAME = MODE === "backend" ? "TEST_TORT_PROD" : "TEST_TORTURE"; // fallback

const runner = MODE === "backend"
  ? async (input, i) => {
      const req = {
        method: "POST",
        body: { text: input },
        ip: `test-ip-${i}`,
        headers: { "x-forwarded-for": `test-ip-${i}` },
      };
      const res = {};
      return await chatPipeline(req, res);
    }
  : runLocal;

const targetUrl = process.env.CHAT_API_URL || "https://min-bot.vercel.app/api/chat";

if (MODE === "backend") {
  console.log(`🚀 Running torture-v3 in BACKEND mode (direct chatPipeline, Sheet tab: ${TAB_NAME})`);
} else {
  console.log(`🚀 Running torture-v3 in LOCAL mode (API handler, Sheet tab: ${TAB_NAME})`);
}

// === Logger/buffer ===
function logResult(category, lang, input, gotLang, expectedLang, reply, ok, debug, preDetect, chatDetect, res) {
  const mark = ok ? "🟩" : "🟥";
  console.log(`[${category}] ${input} → ${gotLang} (expected ${expectedLang}) ${mark}\n↳ Reply: ${reply}`);

  const mismatchMark = (gotLang === expectedLang) ? "🟢" : "🔴";

  rows.push([
    new Date().toISOString(),
    MODE,
    MODE === "backend" ? targetUrl : "-",
    category,
    flagEmoji(lang),
    input,
    flagEmoji(gotLang),
    flagEmoji(expectedLang),
    reply,
    ok ? "OK" : "FAIL",
    debug ? JSON.stringify(debug) : "-",
    JSON.stringify({ input, expected: expectedLang }),
    mismatchMark,
    preDetect,
    chatDetect,
    res?.via || "-"
  ]);
}

// === Lägg till header först ===
rows.push([
  "Timestamp", "Mode", "URL", "Category", "ExpectedLang",
  "Input", "GotLang", "Expected", "Reply", "Status",
  "FilterDebug", "CaseRaw", "LangMismatch", "PreDetect", "ChatDetect", "Via"
]);

// === Main ===
(async () => {
  // === Kör språkfall ===
  for (const lang of LANGS) {
    await Promise.all(
      (testCases[lang] || []).map(async (it, i) => {
        const { input, expected } = normalizeCase(it, lang);

        // PreDetect (regler)
        const pre = await detectLangRulesOnly(input);
        const preDetect = `${pre.lang} (via=${pre.via})`;

        // ChatPipeline
        const res = await runner(input, i);
        const got = res.lang || "UNKNOWN";
        const reply = res.reply || "(no reply)";
        const ok = got === expected;
        if (!ok) mismatches++;

        const chatDetect = `${res.lang || "UNKNOWN"} (via=${res.via || res.source || "?"})`;

        if (pre.lang !== res.lang) {
          preVsChatDiffs++;
          console.warn("⚠️ PreDetect ≠ ChatDetect", { input, preDetect, chatDetect });
        }

        if (pre.via.includes("regex")) stats.regex++;
        else if (pre.via.includes("anchors")) stats.anchors++;
        else if (pre.via.includes("whitelist")) stats.whitelist++;
        else if (pre.via.includes("heuristic")) stats.heuristic++;
        else if (pre.via.includes("AI")) stats.ai++;
        else if (pre.lang === "UNKNOWN") stats.unknown++;

        logResult("LANG", lang, input, got, expected, reply, ok, res.debug, preDetect, chatDetect, res);
      })
    );
  }

  // === Kör specialfall (FUZZY, GIBBERISH, LONG, BLOCK) ===
  for (const type of ["FUZZY", "GIBBERISH", "LONG", "BLOCK"]) {
    await Promise.all(
      (testCases[type] || []).map(async (it, i) => {
        const { input, expected } = normalizeCase(it, type === "FUZZY" ? "SE" : "FILTER");

        const pre = await detectLangRulesOnly(input);
        const preDetect = `${pre.lang} (via=${pre.via})`;

        // ChatPipeline
        const res = await runner(input, i);
        const got = res.lang || "UNKNOWN";
        const reply = res.reply || "(no reply)";
        const ok = got === expected;
        if (!ok) mismatches++;

        const chatDetect = `${res.lang || "UNKNOWN"} (via=${res.via || res.source || "?"})`;

        if (pre.lang !== res.lang) {
          preVsChatDiffs++;
          console.warn("⚠️ PreDetect ≠ ChatDetect", { input, preDetect, chatDetect });
        }

        if (pre.via.includes("regex")) stats.regex++;
        else if (pre.via.includes("anchors")) stats.anchors++;
        else if (pre.via.includes("whitelist")) stats.whitelist++;
        else if (pre.via.includes("heuristic")) stats.heuristic++;
        else if (pre.via.includes("AI")) stats.ai++;
        else if (pre.lang === "UNKNOWN") stats.unknown++;

        logResult(type, expected === "FILTER" ? "-" : expected, input, got, expected, reply, ok, res.debug, preDetect, chatDetect, res);
      })
    );
  }

  // === Summary ===
  rows.push([
    "SUMMARY",
    MODE,
    MODE === "backend" ? targetUrl : "-",
    "SUMMARY",
    "-","-","-","-","-","-","-","-","-",
    `regex=${stats.regex}, anchors=${stats.anchors}, whitelist=${stats.whitelist}, heuristic=${stats.heuristic}, ai=${stats.ai}, unknown=${stats.unknown}`,
    `PreDetect≠ChatDetect=${preVsChatDiffs}, mismatches=${mismatches}`
  ]);

  console.log(`\n🟩 Torture-v3 klart. Totala mismatchar: ${mismatches}`);
  console.table(stats);
  console.log(`⚠️ PreDetect ≠ ChatDetect: ${preVsChatDiffs} fall`);

  // === Sheets export ===
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GCP_CLIENT_EMAIL,
        private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID_MAIN;

    const TAB_NAME = MODE === "backend"
      ? (process.env.SHEET_TAB_NAME_PROD || "TEST_TORT_PROD")
      : (process.env.SHEET_TAB_NAME || "TEST_TORTURE");

    const tabIdEnv = MODE === "backend"
      ? process.env.SHEET_TAB_ID_TEST_TORT_PROD
      : process.env.SHEET_TAB_ID_TEST_TORTURE;
    const SHEET_TAB_ID = parseInt(tabIdEnv, 10) || 0;

    await sheets.spreadsheets.values.clear({ spreadsheetId, range: TAB_NAME });
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: TAB_NAME,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });

    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          { updateSheetProperties: { properties: { sheetId: SHEET_TAB_ID, gridProperties: { frozenRowCount: 1 } }, fields: "gridProperties.frozenRowCount" } },
          { autoResizeDimensions: { dimensions: { sheetId: SHEET_TAB_ID, dimension: "COLUMNS", startIndex: 0, endIndex: rows[0].length } } },
          { updateDimensionProperties: { range: { sheetId: SHEET_TAB_ID, dimension: "COLUMNS", startIndex: 5, endIndex: 6 }, properties: { pixelSize: 200 }, fields: "pixelSize" } },
          { repeatCell: { range: { sheetId: SHEET_TAB_ID, startColumnIndex: 5, endColumnIndex: 6 }, cell: { userEnteredFormat: { wrapStrategy: "WRAP" } }, fields: "userEnteredFormat.wrapStrategy" } },
          { updateDimensionProperties: { range: { sheetId: SHEET_TAB_ID, dimension: "COLUMNS", startIndex: 8, endIndex: 9 }, properties: { pixelSize: 200 }, fields: "pixelSize" } },
          { repeatCell: { range: { sheetId: SHEET_TAB_ID, startColumnIndex: 8, endColumnIndex: 9 }, cell: { userEnteredFormat: { wrapStrategy: "WRAP" } }, fields: "userEnteredFormat.wrapStrategy" } },
          { updateDimensionProperties: { range: { sheetId: SHEET_TAB_ID, dimension: "COLUMNS", startIndex: 13, endIndex: 15 }, properties: { pixelSize: 180 }, fields: "pixelSize" } },
          { repeatCell: { range: { sheetId: SHEET_TAB_ID, startColumnIndex: 13, endColumnIndex: 15 }, cell: { userEnteredFormat: { wrapStrategy: "WRAP" } }, fields: "userEnteredFormat.wrapStrategy" } },
        ]
      }
    });

    console.log(`✅ Resultat exporterat till Google Sheet (${TAB_NAME}, gid=${SHEET_TAB_ID})!`);
  } catch (err) {
    console.error("💥 Batch append/fmt fail:", err.message);
  }
})();
