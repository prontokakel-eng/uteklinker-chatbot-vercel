// tests/debug-sheets.js
import dotenv from "dotenv";
import { loadFaqFromSheet, loadAllFaqData } from "../lib/faq-sheets.js";

dotenv.config({ path: ".env.local" });   // 👈 laddar env.local

async function run() {
  console.log("=== DEBUG SHEETS ===");
  console.log("ENV CHECK:", {
    SHEET_ID_MAIN: process.env.SHEET_ID_MAIN ? "✅" : "❌",
    SHEET_ID: process.env.SHEET_ID ? "✅" : "❌",
    GCP_CLIENT_EMAIL: process.env.GCP_CLIENT_EMAIL ? "✅" : "❌",
    GCP_PRIVATE_KEY: process.env.GCP_PRIVATE_KEY ? "✅" : "❌",
  });

  try {
    console.log("\n--- Laddar FAQ_SE ---");
    const seFaq = await loadFaqFromSheet("SE", "debug-sheets");
    console.log("Antal rader:", seFaq.length);
    console.log("Första 3:", seFaq.slice(0, 3));

    console.log("\n--- Laddar alla språk ---");
    const all = await loadAllFaqData();
    for (const [lang, rows] of Object.entries(all)) {
      console.log(`FAQ_${lang}: ${rows.length} rader`);
    }
  } catch (err) {
    console.error("❌ Fel vid laddning:", err);
  }
}

run();
