// /tests/faq-auto-categorize.mjs
import { google } from "googleapis";
import OpenAI from "openai";
import "../lib/load-env.js";

const clientEmail = process.env.GCP_CLIENT_EMAIL;
const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n");
const spreadsheetId = process.env.SHEET_ID;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (!clientEmail || !privateKey || !spreadsheetId) {
  console.error("❌ Missing GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY, SHEET_ID or OPENAI_API_KEY");
  process.exit(1);
}

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

const categories = ["Produkt", "Installation", "Underhåll", "Leverans", "Kundservice", "Övrigt"];

async function suggestCategory(question, lang) {
  const prompt = `Du är en FAQ-expert. Kategorisera följande fråga (${lang}) i en av kategorierna: ${categories.join(
    ", "
  )}.\n\nFråga: "${question}"\n\nSvara ENDAST med kategorinamnet.`;

  const resp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
  });

  return resp.choices[0].message.content.trim();
}

async function processSheet(lang) {
  console.log(`🔎 Bearbetar språkflik: ${lang}`);
  const range = `${lang}!A2:D`; // hoppa över headers
  const res = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  const rows = res.data.values || [];

  const updates = [];
  for (let i = 0; i < rows.length; i++) {
    const [q, a, source, cat] = rows[i];
    if (!cat || cat.toLowerCase() === "saknas") {
      const suggestion = await suggestCategory(q, lang);
      console.log(`   ➕ "${q}" → ${suggestion}`);
      rows[i][3] = suggestion; // skriv kategori i kolumn D
      updates.push({ row: i + 2, category: suggestion });
    }
  }

  if (updates.length) {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range,
      valueInputOption: "RAW",
      requestBody: { values: rows },
    });
    console.log(`✅ Uppdaterade ${updates.length} rader i ${lang}`);
  } else {
    console.log("ℹ️ Inga saknas-kategorier att fylla.");
  }
}

async function run() {
  console.log("=== 🧪 FAQ Auto-Categorize ===");
  for (const lang of ["SE", "EN", "DA", "DE"]) {
    await processSheet(lang);
  }
  console.log("🎉 Klar!");
}

run();
