import "../lib/load-env.js";
// tests/test-google.js
import { google } from "googleapis";
async function main() {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL || process.env.GCP_CLIENT_EMAIL,
        private_key: (process.env.GOOGLE_PRIVATE_KEY || process.env.GCP_PRIVATE_KEY).replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "FAQ_SE!A1:B5",
    });
    console.log("✅ Test lyckades, data:");
    console.log(res.data.values);
  } catch (err) {
    console.error("❌ Test misslyckades:", err.message);
    console.error(err);
  }
}
main();
