// /tests/generate-faq-sample.mjs
import { google } from "googleapis";
import "../lib/load-env.js";

// === Läs in GCP credentials från env.local ===
const clientEmail = process.env.GCP_CLIENT_EMAIL;
const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n");
const spreadsheetId = process.env.SHEET_ID; // 👈 alltid använd befintligt ark

if (!clientEmail || !privateKey || !spreadsheetId) {
  console.error("❌ Missing GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY or SHEET_ID in env.local");
  process.exit(1);
}

console.log("🔑 Kör med servicekonto:", clientEmail);
console.log(`ℹ️ Using existing sheet: ${spreadsheetId}`);
console.log(`   URL: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);

// === Initiera Google-klienter ===
const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: [
    "https://www.googleapis.com/auth/spreadsheets",
    "https://www.googleapis.com/auth/drive", // full drive access
  ],
});

const sheets = google.sheets({ version: "v4", auth });

// === Data: 1 fråga/svar per språk ===
const sampleData = {
  SE: [
    ["question_se", "answer_se", "source", "category"],
    [
      "Levererar ni till Finland?",
      "Ja, vi kan potentiellt leverera till Finland mot förfrågan. Kontakta oss för offert.",
      "AI",
      "Leverans",
    ],
    [
      "Vilka mått finns klinkerdäck® i?",
      "Plattorna finns i flera olika standardmått. Se vår produktkatalog för aktuella storlekar.",
      "FAQ",
      "saknas", // 👈 kategori ej satt ännu
    ],
  ],
  EN: [
    ["question_en", "answer_en", "source", "category"],
    [
      "Can I place the tiles on a wooden deck?",
      "Yes, the tiles can be placed on a wooden deck if the surface is stable and even.",
      "AI",
      "Installation",
    ],
    [
      "Are the tiles slip-resistant?",
      "Yes, klinkerdäck® tiles have slip-resistant surfaces designed for outdoor use.",
      "FAQ",
      "saknas",
    ],
  ],
  DA: [
    ["question_da", "answer_da", "source", "category"],
    [
      "Skal klinkerdæk behandles med olie?",
      "Nej, klinkerdæk® kræver ingen oliebehandling.",
      "FAQ",
      "Underhåll",
    ],
    [
      "Kan man lægge pladerne på grus?",
      "Ja, klinkerdæk® kan lægges på et stabilt grusunderlag.",
      "AI",
      "saknas",
    ],
  ],
  DE: [
    ["question_de", "answer_de", "source", "category"],
    [
      "Sind die Platten frostsicher?",
      "Ja, klinkerdäck® ist frostsicher und benötigt keine Winterlagerung.",
      "FAQ",
      "Produkt",
    ],
    [
      "Kann man die Platten auf Kies verlegen?",
      "Ja, klinkerdäck® kann auf einem stabilen Kiesuntergrund verlegt werden.",
      "AI",
      "saknas",
    ],
  ],
};

async function updateExistingSheet() {
  try {
    // 1️⃣ Hämta befintliga flikar
    const existing = await sheets.spreadsheets.get({ spreadsheetId });
    const existingTabs = existing.data.sheets.map((s) => s.properties.title);

    // 2️⃣ Lägg till språkflikar om de inte finns
    const requests = Object.keys(sampleData)
      .filter((lang) => !existingTabs.includes(lang))
      .map((lang) => ({
        addSheet: { properties: { title: lang } },
      }));

    if (requests.length) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
      console.log(`   ➕ Added missing sheets: ${requests.map((r) => r.addSheet.properties.title).join(", ")}`);
    }

    // 3️⃣ Lägg till/uppdatera data i varje flik
    for (const [lang, values] of Object.entries(sampleData)) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${lang}!A1`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
      console.log(`   ✍️  Wrote sample row to sheet: ${lang}`);
    }

    console.log("🎉 Klar!");
  } catch (err) {
    console.error("❌ Error filling sheet:", err.message);
  }
}

updateExistingSheet();
