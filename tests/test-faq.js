// tests/test-faq.js
import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000";
const TEST_QUESTION = "Testfråga via Node";
const TEST_ANSWER = "Detta är ett testsvar som ska synas i kolumn B";

async function saveFaq() {
  console.log("💾 Sparar testfråga i Google Sheets...");
  const res = await fetch(`${BASE_URL}/api/save-faq-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: TEST_QUESTION,
      reply: TEST_ANSWER,   // <-- API:et förväntar 'reply'
      lang: "SE",
    }),
  });
  return res.json();
}

async function readFaq() {
  console.log("📖 Läser tillbaka FAQ från servern...");
  const res = await fetch(`${BASE_URL}/api/faq-data?lang=SE`);
  return res.json(); // { success, lang, count, faqs }
}

async function run() {
  try {
    const saveRes = await saveFaq();
    console.log("Svar från /save-faq-reply:", saveRes);

    await new Promise((r) => setTimeout(r, 1500));

    const data = await readFaq();
    console.log(`📊 Antal FAQ-rader: ${data.count}`);
    console.log("👉 Första 3 raderna:");
    (data.faqs || []).slice(0, 3).forEach((f, i) => {
      console.log(`${i + 1}. Q="${f.question}" A="${f.answer}"`);
    });

    const found = (data.faqs || []).find(
      (f) => f.question.trim().toLowerCase() === TEST_QUESTION.toLowerCase()
    );
    if (found) {
      console.log("✅ Hittade testfrågan:", found);
    } else {
      console.log("❌ Testfrågan hittades inte");
    }
  } catch (err) {
    console.error("🚨 Fel i test-faq.js:", err);
  }
}

run();
