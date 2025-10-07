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
  try {
    fs.appendFileSync(path.join(LOG_DIR, "faq-sheets.log"), line + "\n");
  } catch {}
}

// === Global klient-cache + scope-tracker ===
let sheetsClient = null;
let authClient = null;
let scopeMode = "none"; // 'read' | 'write'

// Skapar scopes beroende på read/write-läge
function makeScopes(mode = "read") {
  // Vi överdimensionerar: skriv-scope fungerar även för läsning.
  return mode === "write"
    ? ["https://www.googleapis.com/auth/spreadsheets"]
    : ["https://www.googleapis.com/auth/spreadsheets.readonly"];
}

// Initierar en ny Google Sheets-klient
async function getSheetsClient(caller = "unknown", mode = "read") {
  const { GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY, SHEET_ID } = process.env;
  if (!GCP_CLIENT_EMAIL || !GCP_PRIVATE_KEY || !SHEET_ID) {
    throw new Error("Missing one or more GCP env vars");
  }

  // ✅ PATCH #1 – Uppgradera till write-mode om nödvändigt
  if (mode === "write" && scopeMode !== "write") {
    log("🔁 Upgrading Sheets client from readonly → write");
    sheetsClient = null;
    authClient = null;
  }

  if (sheetsClient && authClient) {
    log(`♻️ Google Sheets client reused (called from: ${caller})`);
    return sheetsClient;
  }

  const scopes = makeScopes(mode);
  const auth = new google.auth.JWT(
    GCP_CLIENT_EMAIL,
    null,
    GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
    scopes
  );
  await auth.authorize();

  scopeMode = mode;
  authClient = auth;
  sheetsClient = google.sheets({ version: "v4", auth });

  log(
    `🔑 Google Sheets client initialized (mode=${mode}, caller=${caller})`
  );
  return sheetsClient;
}

// === Hämtar data från ett kalkylblad ===
export async function readSheet(sheetName) {
  const sheets = await getSheetsClient("readSheet", "read");
  const { SHEET_ID } = process.env;

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!A:Z`,
  });

  log(`✅ Sheet ${sheetName} läst: ${res.data.values?.length || 0} rader`);
  return res.data.values || [];
}

// === Skriver resultat till TEST_TORTURE-fliken (används av benchmark) ===
export async function writeBenchmarkResult({
  sheetId,
  sheetName,
  lang,
  question,
  detectedLang,
  confidence,
  result,
  timestamp,
}) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const sheets = await getSheetsClient("writeBenchmarkResult", "write");

      // ✅ PATCH #2 – rätt property är "resource", inte "requestBody"
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        resource: {
          values: [
            [lang, question, detectedLang, confidence, result, timestamp],
          ],
        },
      });

      log(`✅ Result appended to ${sheetName} (lang=${lang})`);
      return true;
    } catch (err) {
      log(
        `⚠️ Attempt ${attempt} failed to append to ${sheetName}: ${err.message}`
      );
      if (attempt === 3) throw err;
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

export default {
  getSheetsClient,
  readSheet,
  writeBenchmarkResult,
};
