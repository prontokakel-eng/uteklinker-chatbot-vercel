import "../lib/load-env.js";
// tests/test-faq-all-prod.js
import { google } from "googleapis";
async function getSheetsClient() {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GCP_PROJECT_ID,
      private_key_id: process.env.GCP_PRIVATE_KEY_ID,
      private_key: (process.env.GCP_PRIVATE_KEY || "")
        .replace(/\\n/g, "\n")
        .replace(/"/g, "")
        .trim(),
      client_email: process.env.GCP_CLIENT_EMAIL,
      client_id: process.env.GCP_CLIENT_ID,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}
async function testFaq(lang) {
  const sheets = await getSheetsClient();
  const range = `FAQ_${lang}!A:B`;
  console.log(`\n=== Testar FAQ_${lang} i PROD ===`);
  console.log(`📌 SHEET_ID: ${process.env.SHEET_ID}`);
  console.log(`📄 Range: ${range}`);
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range,
    });
    const rows = res.data.values || [];
    console.log(`✅ Hittade ${rows.length - 1} rader i FAQ_${lang}`);
    if (rows.length > 1) {
      console.log(`👀 Första frågan: "${rows[1][0]}"`);
      console.log(`💬 Första svaret: "${rows[1][1]}"`);
    }
  } catch (err) {
    console.error(`❌ Misslyckades för ${lang}:`, err.message);
  }
}
async function main() {
  for (const lang of ["SE", "EN", "DA", "DE"]) {
    await testFaq(lang);
  }
}
main();