import "../lib/load-env.js";
// tests/test-faq-en-prod.js
import { google } from "googleapis";
// Ladda .env.vercel
async function main() {
  console.log("=== Testar FAQ_EN i PROD ===");
  const spreadsheetId = process.env.SHEET_ID;
  console.log("📌 SHEET_ID:", JSON.stringify(spreadsheetId));
  if (!spreadsheetId) {
    console.error("❌ Ingen SHEET_ID i env!");
    return;
  }
  try {
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
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const range = "FAQ_EN!A:B";
    console.log("📄 Range:", range);
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    });
    const rows = res.data.values || [];
    console.log(`✅ Hittade ${rows.length} rader i FAQ_EN`);
    if (rows.length > 0) {
      console.log("👀 Första 3 raderna:");
      rows.slice(0, 3).forEach((r, i) => {
        console.log(`${i}: Q="${r[0]}", A="${r[1]}"`);
      });
    }
  } catch (err) {
    console.error("💥 Sheets error:", err.message);
  }
}
main();