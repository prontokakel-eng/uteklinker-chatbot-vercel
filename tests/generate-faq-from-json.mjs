// generate-faq-from-json.mjs
import fs from "fs";
import path from "path";
import { google } from "googleapis";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

// === Läs in filnamn från CLI-argument ===
const inputFile = process.argv[2];
if (!inputFile) {
  console.error("❌ Du måste ange en JSON-fil. Ex: node generate-faq-from-json.mjs faq_from_pedestals_se.json");
  process.exit(1);
}

// Bygg full sökväg (letar alltid i faq-extended/)
const filePath = path.resolve(process.cwd(), "faq-extended", inputFile);
if (!fs.existsSync(filePath)) {
  console.error(`❌ Filen finns inte: ${filePath}`);
  process.exit(1);
}

// === Läs in dataset ===
const dataset = JSON.parse(fs.readFileSync(filePath, "utf-8"));

let datasets = dataset;
if (Array.isArray(dataset)) {
  // Slå in i SE som fallback
  datasets = { SE: dataset };
}

// === Google Sheets autentisering ===
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL,
    private_key: process.env.GCP_PRIVATE_KEY.replace(/\\n/g, "\n"),
  },
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });
const spreadsheetId = process.env.SHEET_ID;

console.log(`📄 Input JSON: ${filePath}`);

// === Hjälpfunktion: kolla om fliken finns, annars skapa ===
async function ensureSheetExists(sheetName) {
  const res = await sheets.spreadsheets.get({ spreadsheetId });
  const sheet = res.data.sheets.find(
    (s) => s.properties.title === sheetName
  );

  if (!sheet) {
    console.log(`➕ Skapar ny flik: ${sheetName}`);
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: { title: sheetName },
            },
          },
        ],
      },
    });
  }
}

try {
  // Loopa alla språk/nycklar i JSON-filen
  for (const [lang, rawEntries] of Object.entries(datasets)) {
    let entries = Array.isArray(rawEntries)
      ? rawEntries
      : Object.values(rawEntries || {});

    console.log(`   ➕ Laddar ${entries.length} entries för språk/flik: ${lang}`);

    const values = [
      [`question_${lang.toLowerCase()}`, `answer_${lang.toLowerCase()}`, "source", "category"],
      ...entries
        .filter((q) => q && typeof q === "object")
        .map((q) => [
          q.question_se || q.question,
          q.answer_se || q.answer,
          q.source,
          q.category,
        ]),
    ];

    // Se till att fliken finns
    await ensureSheetExists(lang);

    // Rensa hela fliken först
    await sheets.spreadsheets.values.clear({
      spreadsheetId,
      range: `${lang}`,
    });

    // Skriv nya värden
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${lang}!A1`,
      valueInputOption: "RAW",
      requestBody: { values },
    });

    console.log(`✅ Klart: ${lang} uppdaterad med ${entries.length} entries`);
    console.log("   Exempel:", values[1], values[2]);
  }
} catch (err) {
  console.error("❌ Error filling sheet:", err.message);
  process.exit(1);
}
