// /tests/test-google-sheets.js
import { google } from "googleapis";
import "../lib/load-env.js";

const { SHEET_ID_MAIN, SHEET_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY } = process.env;
const SHEET_ID_EFFECTIVE = SHEET_ID_MAIN || SHEET_ID;
const TAB_NAME = process.env.SHEET_TAB_NAME || "TEST_TORTURE";
const mode = process.argv.includes("--write") ? "write" : "read";

console.log(`🔍 Testar Google Sheets ${TAB_NAME}...`);

async function initSheets() {
  const auth = new google.auth.JWT(
    GCP_CLIENT_EMAIL,
    null,
    GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
    ["https://www.googleapis.com/auth/spreadsheets"]
  );
  await auth.authorize();
  const sheets = google.sheets({ version: "v4", auth });
  return sheets;
}

async function readTest(sheets) {
  console.log(`📄 Hämtar från Sheet ID: ${SHEET_ID_EFFECTIVE}, range: ${TAB_NAME}!A:B`);
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID_EFFECTIVE,
      range: `${TAB_NAME}!A:B`,
    });
    const rows = res.data.values || [];
    console.log(`✅ Hittade ${rows.length} rader i ${TAB_NAME}`);
    rows.slice(0, 3).forEach((r, i) => console.log(`${i}: Q="${r[0]}", A="${r[1]}"`));
  } catch (err) {
    console.error("❌ Läsfel:", err.message);
  }
}

async function writeTest(sheets) {
  console.log(`🧪 Försöker skriva en testsrad till ${TAB_NAME}...`);
  const testRow = [`Testskrivning OK`, new Date().toISOString()];
  try {
    const append = await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID_EFFECTIVE,
      range: `${TAB_NAME}!A:B`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [testRow] },
    });
    console.log(`✅ Lyckades skriva rad: ${JSON.stringify(testRow)}`);

    // 🧹 Försök radera testsraden efteråt
    const rowIndex = append.data.updates?.updatedRange?.match(/\d+$/)?.[0];
    if (rowIndex) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId: SHEET_ID_EFFECTIVE,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId: parseInt(process.env.SHEET_TAB_ID_TEST_TORTURE || "0"),
                  dimension: "ROWS",
                  startIndex: Number(rowIndex) - 1,
                  endIndex: Number(rowIndex),
                },
              },
            },
          ],
        },
      });
      console.log(`🧹 Raderade test-rad #${rowIndex}`);
    }
  } catch (err) {
    console.error("❌ Skrivfel:", err.errors?.[0]?.message || err.message);
  }
}

(async () => {
  const sheets = await initSheets();
  if (mode === "write") {
    await writeTest(sheets);
  } else {
    await readTest(sheets);
  }
})();
