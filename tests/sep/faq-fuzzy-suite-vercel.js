import fetch from "node-fetch";

const LOCAL_URL = "http://localhost:3000";
const PROD_URL = "https://uteklinker-chatbot-vercel.vercel.app";

// välj URL beroende på NODE_ENV
const BASE_URL = process.env.NODE_ENV === "production" ? PROD_URL : LOCAL_URL;

async function checkHealth() {
  const res = await fetch(`${BASE_URL}/api/healthz`);
  if (!res.ok) throw new Error(`Health check failed: ${res.status}`);
  const json = await res.json();
  console.log("✅ Health-check:", json);
}

async function checkFaqData() {
  const langs = ["SE", "EN", "DA", "DE"];
  for (const lang of langs) {
    const res = await fetch(`${BASE_URL}/api/faq-data?lang=${lang}`);
    if (!res.ok) throw new Error(`FAQ-data failed for ${lang}`);
    const json = await res.json();
    console.log(`📚 ${lang}: ${json.count} frågor`);
    if (json.faqs?.length) {
      console.log(`   Exempel: Q="${json.faqs[0].question}" A="${json.faqs[0].answer}"`);
    }
  }
}

async function checkChat() {
  const tests = [
    { text: "Hur beställer jag klinker?", lang: "SE" },
    { text: "How to order tiles?", lang: "EN" },
    { text: "Hvordan bestiller jeg fliser?", lang: "DA" },
    { text: "Wie bestelle ich Fliesen?", lang: "DE" },
  ];

  for (const t of tests) {
    const res = await fetch(`${BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(t)
    });
    if (!res.ok) throw new Error(`Chat failed for ${t.lang}`);
    const json = await res.json();
    console.log(`💬 [${t.lang}] "${t.text}" → ${json.reply.slice(0, 80)}... (källa: ${json.source})`);
  }
}

(async () => {
  try {
    await checkHealth();
    await checkFaqData();
    await checkChat();
    console.log("🎉 Alla tester kördes klart!");
  } catch (err) {
    console.error("💥 Testfel:", err);
    process.exit(1);
  }
})();
