// /tests/sheets-readwrite-test.mjs
import "../lib/load-env.js";
import { google } from "googleapis";

console.log("🔎 ENV debug:");
console.log("GCP_CLIENT_EMAIL =", process.env.GCP_CLIENT_EMAIL);
console.log("GCP_PROJECT_ID =", process.env.GCP_PROJECT_ID);
console.log("SHEET_ID =", process.env.SHEET_ID);
console.log("PRIVATE_KEY length =", process.env.GCP_PRIVATE_KEY?.length);

// === Setup auth ===
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

// === Din Sheet ID & flik ===
const SHEET_ID = process.env.SHEET_ID;
const TAB_NAME = "Test";

async function run() {
  try {
    // 1. Skriv en ny rad
    const now = new Date().toISOString();
    const writeRes = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${TAB_NAME}!A:B`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[`📝 RW-test @ ${now}`, "Hej from torture!"]],
      },
    });
    console.log("✅ Wrote row:", writeRes.status);

    // 2. Läs tillbaka de sista 5 raderna
    const readRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${TAB_NAME}!A:B`,
    });

    const rows = readRes.data.values || [];
    const lastRows = rows.slice(-5);
    console.log("📖 Last 5 rows in Test tab:");
    for (const r of lastRows) {
      console.log(" →", r.join(" | "));
    }
  } catch (err) {
    console.error("💥 Sheets RW-test fail:", err.message);
  }
}

run();
