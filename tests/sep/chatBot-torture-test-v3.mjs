// /tests/chatBot-torture-test-v3.mjs
import "../lib/load-env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runChat } from "./helpers/run-chat.js";
import { google } from "googleapis"; // batchar direkt här istället för appendRow

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const casesPath = path.join(__dirname, "test-cases.json");
const testCases = JSON.parse(fs.readFileSync(casesPath, "utf8"));

const LANGS = ["SE", "EN", "DA", "DE"];
let mismatches = 0;
const rows = []; // 🆕 buffer för Google Sheets

/**
 * Logga till terminal + buffra rad till Google Sheets
 */
function logResult(category, lang, input, gotLang, expectedLang, reply, ok) {
  const mark = ok ? "🟩" : "🟥";
  console.log(
    `[${category}] ${input} → ${gotLang} (expected ${expectedLang}) ${mark}\n↳ Reply: ${reply}`
  );

  rows.push([
    new Date().toISOString(), // Timestamp
    category,                 // Typ (LANG, FUZZY, GIBBERISH, LONG, BLOCK)
    lang || "-",              // Förväntat språk
    input,                    // Input-fråga
    gotLang,                  // Detekterat språk
    expectedLang,             // Förväntat resultat
    reply,                    // Svaret från API
    ok ? "OK" : "FAIL",       // Status
    JSON.stringify({ input, expected: expectedLang }) // CaseRaw
  ]);
}

/**
 * Helper: plocka ut input och expected ur sträng eller objekt
 */
function normalizeCase(it, defaultExpected) {
  if (typeof it === "string") {
    return { input: it, expected: defaultExpected };
  }
  return {
    input: it.input,
    expected: it.expected || defaultExpected,
  };
}

(async () => {
  // === Kör språkfrågor ===
  for (const lang of LANGS) {
    for (const it of testCases[lang] || []) {
      const { input, expected } = normalizeCase(it, lang);
      const res = await runChat(input);
      const got = res.lang || "UNKNOWN";
      const reply = res.reply || "(no reply)";
      const ok = got === expected;

      if (!ok) mismatches++;
      logResult("LANG", lang, input, got, expected, reply, ok);
    }
  }

  // === Kör FUZZY / GIBBERISH / LONG / BLOCK ===
  for (const type of ["FUZZY", "GIBBERISH", "LONG", "BLOCK"]) {
    for (const it of testCases[type] || []) {
      const { input, expected } = normalizeCase(
        it,
        type === "FUZZY" ? "SE" : "FILTER"
      );
      const res = await runChat(input);
      const got = res.lang || "UNKNOWN";
      const reply = res.reply || "(no reply)";
      const ok = got === expected;

      if (!ok) mismatches++;
      logResult(type, expected === "FILTER" ? "-" : expected, input, got, expected, reply, ok);
    }
  }

  console.log(`\n🟩 Torture-v3 klart. Totala mismatchar: ${mismatches}`);
  console.log(`📝 Totalt ${rows.length} rader buffrade, skriver till Sheets...`);

  // === Batch write to Google Sheets ===
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GCP_CLIENT_EMAIL,
        private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const sheets = google.sheets({ version: "v4", auth });
    const spreadsheetId = process.env.SHEET_ID;
    const TAB_NAME = "Test";

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: TAB_NAME,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });

    console.log("✅ Alla rader skrivna till Google Sheets i ett anrop!");
  } catch (err) {
    console.error("💥 Batch append fail:", err.message);
  }
})();
