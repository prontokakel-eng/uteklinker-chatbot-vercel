import "../lib/load-env.js";
// test-faq.js
import { normalizeMessage } from "./lib/utils.js";
import { findBestMatch, refreshAllFaqData, getFaqList } from "./lib/faq.js";
import { loadAllFaqData } from "./lib/utils.js";
import OpenAI from "openai";
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
async function run() {
  console.log("🚀 Startar FAQ-test");
  // 1) Ladda FAQ från Google Sheet via utils → in i cachen
  await refreshAllFaqData(loadAllFaqData);
  console.log("✅ FAQ laddad");
  // 2) Visa antal frågor (svenska som exempel)
  const list = getFaqList("SE");
  console.log(`📚 Antal frågor i SE: ${list.length}`);
  // 3) Input (från CLI eller default)
  const input = process.argv[2] || "Wie dick ist eine Platte?";
  const lang = process.argv[3]?.toUpperCase() || "DE"; // valfritt andra arg för språk
  const normalized = normalizeMessage(input);
  console.log("👉 Input:", input);
  console.log("👉 Normalized:", normalized);
  console.log(`🔧 Matchningsmetod: ${String(process.env.USE_FUZZY || "").toLowerCase() === "true" ? "FUZZY" : "ENKEL"}`);
  console.log(`🌐 Språk: ${lang}`);
  // 4) FAQ-match
  const match = findBestMatch(normalized, lang);
  if (match) {
    console.log("🔎 FAQ-match hittad:");
    console.log("Fråga:", match.match.question);
    console.log("Svar:", match.match.answer);
    console.log("Score:", typeof match.score === "number" ? match.score.toFixed(2) : match.score);
    if (match.score >= 0.8) {
      return; // bra träff, klart
    } else {
      console.log("ℹ️ Score under threshold, går vidare till AI...");
    }
  } else {
    console.log("❌ Ingen FAQ-match hittad, går vidare till AI...");
  }
  // 5) AI-fallback
  const aiResponse = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content: "Du är en hjälpsam kundsupportagent för byggprodukter. Svara kortfattat och tydligt.",
      },
      { role: "user", content: normalized },
    ],
  });
  const reply = aiResponse.choices[0].message.content;
  console.log("🤖 AI-svar:");
  console.log(reply);
}
run().catch((err) => {
  console.error("💥 Fel vid körning:", err);
});