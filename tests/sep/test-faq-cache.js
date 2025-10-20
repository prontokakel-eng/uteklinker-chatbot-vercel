import "../lib/load-env.js";
// tests/test-faq-cache.js
import { loadAllFaqData } from "./../lib/utils.js";
(async () => {
  console.log("🔍 Testar FAQ-cache preload...");
  console.log("📌 SHEET_ID i env:", process.env.SHEET_ID);
  try {
    const data = await loadAllFaqData();
    for (const [lang, rows] of Object.entries(data)) {
      console.log(`📚 FAQ_${lang}: ${rows.length} frågor`);
      if (rows.length > 0) {
        console.log("👀 Första frågan:", rows[0].question);
        console.log("💬 Första svaret:", rows[0].answer);
      }
    }
    console.log("✅ FAQ-cache laddades OK!");
  } catch (err) {
    console.error("💥 Kunde inte ladda FAQ-cache:", err);
  }
})();
