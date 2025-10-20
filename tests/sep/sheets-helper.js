// /tests/sheets-helper.js
import { google } from "googleapis";

/**
 * Säkerställer att arket har rätt headers innan vi skriver rader.
 */
async function ensureHeaders(sheets, spreadsheetId, sheetName) {
  const headers = [
    "Timestamp",
    "Category",
    "Lang",
    "Input",
    "Got",
    "Expected",
    "Reply",
    "Result",
    "CaseRaw"
  ];

  try {
    const meta = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!1:1`
    });

    const current = meta.data.values?.[0] || [];
    const missing = headers.filter((h, i) => current[i] !== h);

    if (missing.length > 0) {
      console.log(`📝 Adding headers to ${sheetName}:`, headers.join(", "));
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: [headers] }
      });
    }
  } catch (err) {
    console.warn("⚠️ ensureHeaders fail (sheet tomt?), skriver rubriker från scratch:", err.message);
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [headers] }
    });
  }
}

/**
 * Append en rad med testresultat.
 */
export async function appendRow(sheetName, values) {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GCP_CLIENT_EMAIL,
      private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n")
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"]
  });

  const sheets = google.sheets({ version: "v4", auth });
  const spreadsheetId = process.env.SHEET_ID;

  try {
    await ensureHeaders(sheets, spreadsheetId, sheetName);

    console.log(`📤 appendRow → sheet="${sheetName}", cols=${values.length}`);
    const res = await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: sheetName,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [values] }
    });

    console.log("✅ appendRow OK:", res.data.updates?.updatedRange || "(no range)");
  } catch (err) {
    console.error("💥 appendRow FAIL:", err.message, err.errors || "");
  }
}
