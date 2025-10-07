import "../lib/load-env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { google } from "googleapis";
import handler from "../api/chat.js";
import { detectLangRulesOnly } from "../lib/detect-lang-rules.js";
import { detectLangSafe } from "../lib/detect-lang.js";
import wordLists from "../config/BL-WL-words-list.json" with { type: "json" };
import { chatPipeline } from "../lib/chatPipeline.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(`📝 Running script: ${__filename}`);

const LOG_DIR = path.join(process.cwd(), "tests", "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const LOG_FILE = path.join(LOG_DIR, `torture-v4-${timestamp}.log`);
function logToFile(line) {
  try { fs.appendFileSync(LOG_FILE, line + "\n", { encoding: "utf8" }); } catch {}
}
console.log(`🗒️ Logfile: ${LOG_FILE}`);
logToFile(`=== TORTURE V4 START ${new Date().toISOString()} ===`);

const RUN_ID = Date.now().toString(36);
let SEQ = 0;
const nextIp = (tag) =>
  `test-ip-${RUN_ID}-${SEQ++}-${String(tag).replace(/[^a-z0-9:_-]/gi, "-")}`;

// 🧩 Läs in test-cases-fil (default = test-cases-full.json) +BOM-safe)
const CASES_FILE = process.env.TEST_CASES_FILE?.trim() || "test-cases-full.json";
const casesPath = path.join(__dirname, CASES_FILE);
console.log(`🧾 Test cases source: ${CASES_FILE}`);
const fileData = fs.readFileSync(casesPath, "utf8").replace(/^\uFEFF/, "");
const testCases = JSON.parse(fileData);

// 🧾 Flik alltid TEST_TORTURE för local testning
const TAB_NAME = process.env.SHEET_TAB_NAME || "TEST_TORTURE";
const TAB_ID = parseInt(process.env.SHEET_TAB_ID_TEST_TORTURE, 10) || 0;
console.log(`📤 Export target: ${TAB_NAME} (gid=${TAB_ID})`);
logToFile(`📤 Export target: ${TAB_NAME} (gid=${TAB_ID})`);

const LANGS = ["SE", "EN", "DA", "DE"];
let mismatches = 0;
let preVsChatDiffs = 0;
const rows = [];
const stats = { regex: 0, anchors: 0, whitelist: 0, heuristic: 0, ai: 0, unknown: 0 };
const mismatchCases = [];

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

function normalizeCase(it, defaultExpected) {
  if (typeof it === "string") return { input: it, expected: defaultExpected };
  return { input: it.input, expected: it.expected || defaultExpected };
}

async function runLocal(input, tag = "case") {
  const ip = nextIp(tag);
  const req = { method: "POST", body: { text: input }, headers: { "x-forwarded-for": ip } };
  let result;
  const res = {
    status(code) { this.code = code; return this; },
    json(obj) { result = obj; return this; },
    setHeader() {}
  };
  await handler(req, res);
  const detectRes = await detectLangSafe(input, "test");
  result.lang = detectRes.lang;
  result.via = detectRes.via;
  return result;
}

const MODE = process.env.TEST_MODE || "local";
const runner = MODE === "backend"
  ? async (input, tag) => {
      const ip = nextIp(tag);
      const req = { method: "POST", body: { text: input }, ip, headers: { "x-forwarded-for": ip } };
      const res = {};
      return await chatPipeline(req, res);
    }
  : runLocal;

const targetUrl = process.env.CHAT_API_URL || "http://localhost:3000/api/chat";
console.log(`🚀 Running torture-v4 in ${MODE.toUpperCase()} mode → ${targetUrl}`);
logToFile(`🚀 Mode=${MODE}, target=${targetUrl}`);

function logResult(category, lang, input, gotLang, expectedLang, reply, ok, debug, preDetect, chatDetect, res) {
  const mark = ok ? "🟩" : "🟥";
  const line = `[${category}] ${input} → ${gotLang} (expected ${expectedLang}) ${mark}\n↳ Reply: ${reply}`;
  console.log(line);
  logToFile(line);
  if (!ok) mismatchCases.push({ type: category, input, got: gotLang, expected: expectedLang });
  const mismatchMark = gotLang === expectedLang ? "🟢" : "🔴";
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

rows.push([
  "Timestamp","Mode","URL","Category","ExpectedLang",
  "Input","GotLang","Expected","Reply","Status",
  "FilterDebug","CaseRaw","LangMismatch","PreDetect","ChatDetect","Via"
]);

(async () => {
  for (const lang of LANGS) {
    await Promise.all((testCases[lang] || []).map(async (it, i) => {
      const { input, expected } = normalizeCase(it, lang);
      const pre = await detectLangRulesOnly(input);
      const preDetect = `${pre.lang} (via=${pre.via})`;
      const res = await runner(input, `LANG:${lang}:${i}`);
      const got = res.lang || "UNKNOWN";
      const reply = typeof res.reply === "object" ? JSON.stringify(res.reply) : res.reply || "(no reply)";
      const ok =
        got === expected ||
        (res.source === "GREETING" && ["SE","EN","DA","DE"].includes(expected)) ||
        (res.via === "filtered-long" && expected === "FILTER");
      if (!ok) mismatches++;
      const chatDetect = `${res.lang || "UNKNOWN"} (via=${res.via || res.source || "?"})`;
      if (pre.lang !== res.lang) {
        preVsChatDiffs++;
        const warn = `⚠️ PreDetect ≠ ChatDetect { input="${input}", pre=${preDetect}, chat=${chatDetect} }`;
        console.warn(warn);
        logToFile(warn);
      }
      if (pre.via.includes("regex")) stats.regex++;
      else if (pre.via.includes("anchors")) stats.anchors++;
      else if (pre.via.includes("whitelist")) stats.whitelist++;
      else if (pre.via.includes("heuristic")) stats.heuristic++;
      else if (pre.via.includes("AI")) stats.ai++;
      else if (pre.lang === "UNKNOWN") stats.unknown++;
      logResult("LANG", lang, input, got, expected, reply, ok, res.debug, preDetect, chatDetect, res);
    }));
  }

  for (const type of ["FUZZY","GIBBERISH","LONG","BLOCK","GREETING","RELEVANCE"]) {
    await Promise.all((testCases[type] || []).map(async (it, i) => {
      const { input, expected } = normalizeCase(it, type === "FUZZY" ? "SE" : type === "GREETING" ? "SE" : "FILTER");
      const pre = await detectLangRulesOnly(input);
      const preDetect = `${pre.lang} (via=${pre.via})`;
      const res = await runner(input, `${type}:${i}`);
      const got = res.lang || "UNKNOWN";
      const reply = typeof res.reply === "object" ? JSON.stringify(res.reply) : res.reply || "(no reply)";
      const ok =
        got === expected ||
        (res.source === "GREETING" && ["SE","EN","DA","DE"].includes(expected)) ||
        (res.via === "filtered-long" && expected === "FILTER");
      if (!ok) mismatches++;
      const chatDetect = `${res.lang || "UNKNOWN"} (via=${res.via || res.source || "?"})`;
      if (pre.lang !== res.lang) {
        preVsChatDiffs++;
        const warn = `⚠️ PreDetect ≠ ChatDetect { input="${input}", pre=${preDetect}, chat=${chatDetect} }`;
        console.warn(warn);
        logToFile(warn);
      }
      if (pre.via.includes("regex")) stats.regex++;
      else if (pre.via.includes("anchors")) stats.anchors++;
      else if (pre.via.includes("whitelist")) stats.whitelist++;
      else if (pre.via.includes("heuristic")) stats.heuristic++;
      else if (pre.via.includes("AI")) stats.ai++;
      else if (pre.lang === "UNKNOWN") stats.unknown++;
      logResult(type, expected === "FILTER" ? "-" : expected, input, got, expected, reply, ok, res.debug, preDetect, chatDetect, res);
    }));
  }

  rows.push([
    "SUMMARY", MODE, MODE === "backend" ? targetUrl : "-", "SUMMARY",
    "-","-","-","-","-","-","-","-","-",
    `regex=${stats.regex}, anchors=${stats.anchors}, whitelist=${stats.whitelist}, heuristic=${stats.heuristic}, ai=${stats.ai}, unknown=${stats.unknown}`,
    `PreDetect≠ChatDetect=${preVsChatDiffs}, mismatches=${mismatches}`
  ]);

  const summary1 = `\n🟩 Torture-v4 klart. Totala mismatchar: ${mismatches}`;
  const summary2 = `⚠️ PreDetect ≠ ChatDetect: ${preVsChatDiffs} fall`;
  console.log(summary1);
  console.table(stats);
  console.log(summary2);
  logToFile(summary1);
  logToFile(JSON.stringify(stats));
  logToFile(summary2);

  if (mismatchCases.length > 0) {
    logToFile("=== MISMATCHED CASES ===");
    mismatchCases.forEach(m =>
      logToFile(`[${m.type}] "${m.input}" → got=${m.got}, expected=${m.expected}`)
    );
  }

  try {
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: process.env.GCP_CLIENT_EMAIL, private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n") },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID_MAIN;

    await sheets.spreadsheets.values.clear({ spreadsheetId, range: TAB_NAME });
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: TAB_NAME,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });

    console.log(`✅ Resultat exporterat till Google Sheet (${TAB_NAME}, gid=${TAB_ID})!`);
    logToFile(`✅ Sheets export ok → tab=${TAB_NAME} gid=${TAB_ID}`);
  } catch (err) {
    console.error("💥 Batch append/fmt fail:", err.message);
    logToFile(`💥 Sheets export fail: ${err.message}`);
  }

  logToFile(`=== END ${new Date().toISOString()} ===`);
})();
