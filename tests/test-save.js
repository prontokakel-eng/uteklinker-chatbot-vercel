// tests/test-save.js
import fetch from "node-fetch";

const BASE_URL = "http://localhost:3000";

async function saveFaq() {
  console.log("💾 Sparar FAQ-test...");
  const res = await fetch(`${BASE_URL}/api/save-faq-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "Testfråga FAQ",
      reply: "Detta är ett testsvar (FAQ)",
      lang: "SE",
    }),
  });
  return res.json();
}

async function saveAi() {
  console.log("💾 Sparar AI-test...");
  const res = await fetch(`${BASE_URL}/api/save-ai-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question: "Testfråga AI",
      answer: "Detta är ett testsvar (AI)",
      lang: "SE",
    }),
  });
  return res.json();
}

async function run() {
  try {
    const faqResult = await saveFaq();
    console.log("📊 Resultat FAQ:", faqResult);

    const aiResult = await saveAi();
    console.log("📊 Resultat AI:", aiResult);

    console.log("\n👉 Kontrollera nu i Google Sheet:");
    console.log("- 'Testfråga FAQ' ska ligga i kolumn A, svaret i B, och 'FAQ' i C.");
    console.log("- 'Testfråga AI' ska ligga i kolumn A, svaret i B, och 'AI' i C.");
  } catch (err) {
    console.error("🚨 Fel i test-save.js:", err);
  }
}
run();
