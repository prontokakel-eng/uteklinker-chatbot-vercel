// /lib/faq-sheets.js
import "./load-env.js";
import { validateEnv } from "./env-check.js";
import fs from "fs";
import path from "path";
import { logMessage } from "./logger.js"; // 🧩 PATCH: för clearSheet-loggning

let sheetsClient;
const pendingWrites = []; // 🧩 PATCH: Kö för batchskrivning

/**
 * Hämtar eller initierar en Google Sheets-klient
 */
export async function getSheetsClient(caller = "unknown") {
  if (sheetsClient) {
    console.log(`♻️ Google Sheets client reused (called from: ${caller})`);
    return sheetsClient;
  }

  // ✅ Kolla miljövariabler innan vi initierar
  validateEnv([
    ["GOOGLE_SERVICE_ACCOUNT_EMAIL", "GCP_CLIENT_EMAIL"],
    ["GOOGLE_SERVICE_ACCOUNT_KEY", "GCP_PRIVATE_KEY"],
    ["SHEET_ID_MAIN", "SHEET_ID"],
  ]);

  const email = process.env.GCP_CLIENT_EMAIL || process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GCP_PRIVATE_KEY || process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  const sheetId = process.env.SHEET_ID_MAIN || process.env.SHEET_ID;

  console.log("[faq-sheets] Init Sheets client med env:", {
    email: email ? "✅" : "❌",
    key: key ? "✅" : "❌",
    sheetId: sheetId ? "✅" : "❌",
  });

  const {google}=await import("googleapis");
  const auth = new google.auth.JWT({
    email,
    key: key?.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  sheetsClient = google.sheets({ version: "v4", auth });
  console.log(`🔑 Google Sheets client initialized (first call from: ${caller})`);

  return sheetsClient;
}

// === FAQ (FAQ_SE, FAQ_EN, FAQ_DA, FAQ_DE) ===
export async function loadFaqFromSheet(lang = "SE", caller = "loadFaqFromSheet") {
  const sheets = await getSheetsClient(caller);
  const sheetName = `FAQ_${lang}`;
  const range = `${sheetName}!A:B`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID_MAIN || process.env.SHEET_ID,
    range,
  });

  const rows = response.data.values || [];
  return rows.slice(1).map(([q = "", a = ""]) => ({
    q: String(q).trim(),
    a: String(a).trim(),
  }));
}

// === Lookup (SE_FULL_LOOKUP, EN_FULL_LOOKUP, DA_FULL_LOOKUP, DE_FULL_LOOKUP) ===
export async function loadLookupFromSheet(lang = "SE", caller = "loadLookupFromSheet") {
  const sheets = await getSheetsClient(caller);
  const sheetName = `${lang}_FULL_LOOKUP`;
  const range = `${sheetName}!A:A`;

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID_MAIN || process.env.SHEET_ID,
    range,
  });

  const rows = response.data.values || [];
  return rows
   .slice(1)
   .map(([kw = ""]) => ({ keyword: String(kw).trim().toLowerCase() }))
   .filter(Boolean);
}

// === Ladda alla FAQ (alla språk) ===
export async function loadAllFaqData() {
  const langs = ["SE", "EN", "DA", "DE"];
  const result = {};

  for (const lang of langs) {
    try {
      result[lang] = await loadFaqFromSheet(lang, "loadAllFaqData");
      console.log(`[faq-sheets] ✅ Loaded FAQ_${lang}: ${result[lang].length} rows`);
    } catch (err) {
      console.error(`[faq-sheets] ⚠️ Failed to load FAQ_${lang}:`, err.message);
      result[lang] = [];
    }
  }
  return result;
}

// === Ladda alla Lookups (alla språk) ===
export async function loadAllLookups() {
  const langs = ["SE", "EN", "DA", "DE"];
  const result = {};

  for (const lang of langs) {
    try {
      result[lang] = await loadLookupFromSheet(lang, "loadAllLookups");
      console.log(`[faq-sheets] ✅ Loaded ${lang}_FULL_LOOKUP: ${result[lang].length} keywords`);
    } catch (err) {
      console.error(`[faq-sheets] ⚠️ Failed to load ${lang}_FULL_LOOKUP:`, err.message);
      result[lang] = [];
    }
  }
  return result;
}

// === 🧩 Torture Benchmark Helpers ===
export async function loadAllFAQSheets() {
  const langs = ["SE", "EN", "DA", "DE"];
  const result = {};

  for (const lang of langs) {
    try {
      const rows = await loadFaqFromSheet(lang, "loadAllFAQSheets");
      result[lang] = rows.map((r) => ({
        question: r.q || r.question || "",
        answer: r.a || r.answer || "",
      }));
      console.log(`[faq-sheets] ✅ FAQ_${lang} loaded for benchmark: ${result[lang].length}`);
    } catch (err) {
      console.error(`[faq-sheets] ⚠️ Failed to load FAQ_${lang}:`, err.message);
      result[lang] = [];
    }
  }

  return result;
}

// === 🧩 PATCH: Ny Batch Write-implementation ===
export async function queueBenchmarkResult(entry) {
  pendingWrites.push(entry);
  console.log(`🧩 Queued benchmark entry for: ${entry.lang} (${entry.sheetName || "TEST_TORTURE"})`);
}

export async function flushPendingWrites(sheetId) {
  if (pendingWrites.length === 0) {
    console.log("ℹ️ No pending writes to flush.");
    return;
  }

  console.log(`🧩 Flushing ${pendingWrites.length} pending benchmark rows...`);
  const sheets = await getSheetsClient("flushPendingWrites");

  const grouped = {};
  for (const e of pendingWrites) {
    const name = e.sheetName || "TEST_TORTURE";
    if (!grouped[name]) grouped[name] = [];
    grouped[name].push([
      e.lang,
      e.question,
      e.detectedLang,
      e.confidence,
      e.result,
      e.timestamp,
    ]);
  }

  for (const [sheetName, values] of Object.entries(grouped)) {
    try {
      await sheets.spreadsheets.values.append({
        spreadsheetId: sheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        resource: { values },
      });
      console.log(`✅ Flushed ${values.length} rows to ${sheetName}`);
    } catch (err) {
      console.error(`⚠️ Failed to flush to ${sheetName}: ${err.message}`);
    }
  }

  pendingWrites.length = 0;
  console.log("🏁 All pending writes flushed.");
}

// --- Compatibility alias for legacy tests ---
export async function writeBenchmarkResult(entry) {
  return queueBenchmarkResult(entry);
}

// 🧹 CLEAR SHEET – Endast tillåten i dev + explicit aktiverad
export async function clearSheet(sheetId, tabName) {
  const env = process.env;
  const isProd =
    env.NODE_ENV === "production" || env.VERCEL_ENV === "production";
  const allowClear = env.CLEAR_GOOGLE_TAB_BEFORE_RUN === "true";

  if (isProd) {
    const msg = `🚫 clearSheet() blockerat – production-miljö (${tabName})`;
    logMessage("faq-sheets.log", msg);
    console.warn(msg);
    return false;
  }

  if (!allowClear) {
    const msg = `🚫 clearSheet() blockerat – CLEAR_GOOGLE_TAB_BEFORE_RUN=false`;
    logMessage("faq-sheets.log", msg);
    console.warn(msg);
    return false;
  }

  try {
    const sheets = await getSheetsClient("clearSheet");
    await sheets.spreadsheets.values.clear({
      spreadsheetId: sheetId,
      range: `${tabName}!A:Z`,
    });
    const msg = `🧹 Cleared tab "${tabName}" in sheet ${sheetId}`;
    logMessage("faq-sheets.log", msg);
    console.log(msg);
    return true;
  } catch (err) {
    const msg = `⚠️ clearSheet() error for ${tabName}: ${err.message}`;
    logMessage("faq-sheets.log", msg);
    console.error(msg);
    return false;
  }
}
