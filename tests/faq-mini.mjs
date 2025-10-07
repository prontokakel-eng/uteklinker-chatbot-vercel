// /tests/faq-mini.mjs
import "../lib/load-env.js";          // laddar .env / Vercel vars
import OpenAI from "openai";
import stringSimilarity from "string-similarity";

// --- Sanity check ---
console.log("🔍 API-key length:", process.env.OPENAI_API_KEY?.length);
console.log("🔍 Project-ID:", process.env.OPENAI_PROJECT_ID);

// --- Initiera OpenAI med Project-header ---
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  defaultHeaders: {
    "OpenAI-Project": process.env.OPENAI_PROJECT_ID
  }
});


// --- Selftest: kontrollera API ---
async function selftest() {
  try {
    const models = await openai.models.list();
    console.log("✅ Selftest: modeller:", models.data.slice(0, 3).map(m => m.id).join(", "));

    const chat = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: "Hello from faq-mini selftest" }],
      max_tokens: 20
    });
    console.log("✅ Selftest: chat completion:", chat.choices[0]?.message?.content?.trim());
  } catch (err) {
    console.error("❌ Selftest FAIL:", err.message);
  }
}

// --- Minimal FAQ-cache ---
const FAQ_CACHE = {
  SE: [
    {
      question: "Hur stora är plattorna?",
      answer: "De är 30x30 cm."
    }
  ]
};

// --- Normalisering ---
function normalizeMessage(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/[.,!?;:()"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- FAQ-match + fallback ---
async function runMiniTest(input) {
  console.log("\n✅ Input:", input);

  const questions = FAQ_CACHE.SE.map(f => normalizeMessage(f.question));
  const matches = stringSimilarity.findBestMatch(normalizeMessage(input), questions);

  if (matches.bestMatch.rating > 0.6) {
    const bestMatch = FAQ_CACHE.SE[matches.bestMatchIndex];
    console.log("🔎 FAQ-match:", bestMatch.question);
    console.log("💬 FAQ-svar:", bestMatch.answer);
  } else {
    console.log("⚠️ Ingen FAQ-träff, testar AI-fallback...");
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Du är en FAQ-bot för Uteklinker." },
          { role: "user", content: input }
        ],
        max_tokens: 100
      });
      console.log("🤖 AI-svar:", response.choices[0]?.message?.content?.trim());
    } catch (err) {
      console.error("💥 AI-fallback fail:", err.message);
    }
  }
}

// --- Run ---
(async () => {
  await selftest();                      // kör API-debug först
  await runMiniTest("Hur stora är plattorna?");   // FAQ-träff
  await runMiniTest("Fungerar de i kallt klimat?"); // borde trigga AI
})();
