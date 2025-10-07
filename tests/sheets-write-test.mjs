// /tests/sheets-write-test.mjs
import "../lib/load-env.js";
import { google } from "googleapis";
import fs from "fs";

// === Ladda credentials från ENV ===
const clientEmail = process.env.GCP_CLIENT_EMAIL;
const privateKey = (process.env.GCP_PRIVATE_KEY || "").replace(/\\n/g, "\n");
const sheetId = process.env.SHEET_ID;

if (!clientEmail || !privateKey || !sheetId) {
  console.error("❌ Missing Google Sheets ENV vars");
  process.exit(1);
}

// === Init Google auth ===
const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });

// === Testskrivning ===
async function run() {
  try {
    const range = "Test!A1"; // cell i Test-fliken
    const value = `✅ Torture-write test @ ${new Date().toISOString()}`;

    const res = await sheets.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range,
      valueInputOption: "RAW",
      requestBody: {
        values: [[value]],
      },
    });

    console.log("🟩 Write OK:", res.data.updatedRange, "→", value);
  } catch (err) {
    console.error("💥 Write FAIL:", err.message);
  }
}

run();
