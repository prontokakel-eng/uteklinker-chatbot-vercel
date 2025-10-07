// lib/sheets.js
import { google } from "googleapis";

// --- Google Auth ---
function getAuth() {
  const clean = (v) => (v || "").replace(/^"|"$/g, "").trim();

  return new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: clean(process.env.GCP_PROJECT_ID),
      private_key_id: clean(process.env.GCP_PRIVATE_KEY_ID),
      private_key: (process.env.GCP_PRIVATE_KEY || "")
        .replace(/\\n/g, "\n")
        .replace(/^"|"$/g, "")
        .trim(),
      client_email: clean(process.env.GCP_CLIENT_EMAIL),
      client_id: clean(process.env.GCP_CLIENT_ID),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

async function getSheetsClient() {
  const auth = await getAuth();
  return google.sheets({ version: "v4", auth });
}

// --- Hämta FAQ från Google Sheets ---
export async function loadFaqFromSheet(lang = "SE") {
  const sheets = await getSheetsClient();
  const sheetName = `FAQ_${lang}`;
  const range = `${sheetName}!A:B`;

  if (!process.env.SHEET_ID) {
    throw new Error(`❌ SHEET_ID saknas i process.env för ${sheetName}`);
  }

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEET_ID,
    range,
  });

  const rows = response.data.values || [];
  return rows
    .slice(1)
    .map(([q = "", a = ""]) => ({
      question: String(q).trim(),
      answer: String(a).trim(),
    }))
    .filter((f) => f.question && f.answer);
}

// --- Ladda alla språk vid serverstart ---
export async function loadAllFaqData() {
  const langs = ["SE", "DA", "DE", "EN"];
  const allFaqData = {};

  for (const lang of langs) {
    try {
      const data = await loadFaqFromSheet(lang);
      allFaqData[lang] = data;
      console.log(`✅ Laddade ${data.length} frågor (${lang}).`);
    } catch (err) {
      console.error(`💥 Kunde inte ladda FAQ för ${lang}:`, err.message);
      allFaqData[lang] = [];
    }
  }

  return allFaqData;
}

// --- Spara AI-svar ---
export async function saveAiReply(question, reply, lang = "SE") {
  const sheets = await getSheetsClient();
  const sheetName = `AI_${lang}`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range: `${sheetName}!A:B`,
    valueInputOption: "RAW",
    requestBody: { values: [[question, reply]] },
  });
}

// --- Spara FAQ-svar ---
export async function saveFaqReply(question, reply, lang = "SE") {
  const sheets = await getSheetsClient();
  const sheetName = `FAQ_${lang}`;
  await sheets.spreadsheets.values.append({
    spreadsheetId: process.env.SHEET_ID,
    range: `${sheetName}!A:B`,
    valueInputOption: "RAW",
    requestBody: { values: [[question, reply]] },
  });
}
