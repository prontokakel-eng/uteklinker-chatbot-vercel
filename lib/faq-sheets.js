// /lib/faq-sheets.js
import { google } from "googleapis";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";
import "./load-env.js"; // säkerställ sanerad env

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.resolve(__dirname, "../tests/logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

function log(msg) {
  const line = `[faq-sheets] ${msg}`;
  console.log(line);
  try { fs.appendFileSync(path.join(LOG_DIR, "faq-sheets.log"), line + "\n"); } catch {}
}

// === Global klient-cache + scope-tracker ===
let sheetsClient = null;
let authClient = null;
let scopeMode = "none"; // 'read' | 'write'

function makeScopes(mode = "read") {
  // Vi överdimensionerar: skriv-scope fungerar även för läsning.
  return mode === "write"
    ? ["https://www.googleapis.com/auth/spreadsheets"]
    : ["https://www.googleapis.com/auth/spreadsheets.readonly"];
}

async function ensureClient(mode = "write", caller = "unknown") {
  // ⚠️ Viktigt: om vi tidigare initierade med readonly, uppgradera till write.
  if (sheetsClient && scopeMode === "write") {
    log(`♻️ Google Sheets client reused (called from: ${caller})`);
    return sheetsClient;
  }
  if (sheetsClient && scopeMode === "read" && mode === "write") {
    // Släpp readonly-klienten – vi behöver ny med write-scope.
    sheetsClient = null;
    authClient = null;
    log("🔁 Upgrading Sheets client from readonly → write");
  }

  const email = process.env.GCP_CLIENT_EMAIL;
  let key = process.env.GCP_PRIVATE_KEY || "";
  if (key.includes("\\n")) key = key.replace(/\\n/g, "\n");

  const scopes = makeScopes(mode);
  scopeMode = mode;

  authClient = new google.auth.JWT(email, null, key, scopes);
  await authClient.authorize();
  sheetsClient = google.sheets({ version: "v4", auth: authClient });
  log(`🔑 Google Sheets client initialized (mode=${mode}, caller=${caller})`);
  return sheetsClient;
}

// === Läs alla FAQ-flikar ===
export async function loadAllFAQSheets() {
  const sheetId = process.env.SHEET_ID_MAIN || process.env.SHEET_ID;
  const langs = ["SE", "EN", "DA", "DE"];
  const res = {};
  const sheets = await ensureClient("read", "loadAllFAQSheets");  // 💡 ska bara läsa

  for (const lang of langs) {
    const range = `FAQ_${lang}!A:C`;
    try {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
      res[lang] = r.data.values || [];
      log(`✅ FAQ_${lang} loaded for benchmark: ${res[lang].length}`);
    } catch (err) {
      log(`⚠️ Failed to load FAQ_${lang}: ${err.message}`);
      res[lang] = [];
    }
  }
  return res;
}

// === Bakåtkompatibel alias ===
export const loadAllFaqData = loadAllFAQSheets;

// === Ladda FULL_LOOKUP-flikar (bakåtkompatibilitet) ===
export async function loadAllLookups() {
  const sheetId = process.env.SHEET_ID_MAIN || process.env.SHEET_ID;
  const langs = ["SE", "EN", "DA", "DE"];
  const sheets = await ensureClient("read", "loadAllLookups");  // 💡 korrekt: endast läsning
  const out = {};

  for (const lang of langs) {
    const range = `${lang}_FULL_LOOKUP!A:B`;
    try {
      const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range });
      const n = r.data.values?.length || 0;
      out[lang] = n;
      log(`✅ Loaded ${lang}_FULL_LOOKUP: ${n} keywords`);
    } catch (err) {
      log(`⚠️ Failed to load ${lang}_FULL_LOOKUP: ${err.message}`);
      out[lang] = 0;
    }
  }
  return out;
}

// === Skriv benchmark-rad ===
export async function writeBenchmarkResult(row, attempt = 1) {
  const sheetId = process.env.SHEET_ID_MAIN || process.env.SHEET_ID;
  const tab = process.env.SHEET_TAB_NAME || "TEST_TORTURE";

  // 🛡️ Bypass eventuell readonly-klient: initiera WRITE-klient varje gång vi ska skriva.
  const sheets = await ensureClient("write", "writeBenchmarkResult");

  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${tab}!A:Z`,            // stor range för säkerhets skull
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
    log(`✅ Wrote to ${tab}: ${JSON.stringify(row)}`);
  } catch (err) {
    log(`⚠️ Attempt ${attempt} failed to append to ${tab}: ${err.message}`);
    if (attempt < 3) {
      return writeBenchmarkResult(row, attempt + 1);
    } else {
      const fallback = path.join(LOG_DIR, "failed-benchmark-writes.csv");
      try { fs.appendFileSync(fallback, (row || []).join(",") + "\n"); } catch {}
      log(`❌ All attempts failed (${err.message}). Fallback saved to ${fallback}`);
    }
  }
}

export default {
  loadAllFAQSheets,
  loadAllFaqData,
  loadAllLookups,
  writeBenchmarkResult,
};
