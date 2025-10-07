// tests/test-chat-prod.js
import fetch from "node-fetch";

// Ändra URL om ditt projekt heter något annat på Vercel
const PROD_URL = "https://uteklinker-chatbot-vercel.vercel.app/api/chat";

async function testChatProd() {
  try {
    const response = await fetch(PROD_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Hur beställer jag klinker?", lang: "SE" }),
    });

    console.log("status:", response.status);

    const text = await response.text();
    console.log("raw response:", text);

    try {
      const json = JSON.parse(text);
      console.log("json:", json);
    } catch {
      console.warn("⚠️ Kunde inte parsa JSON (fick HTML/error-sida)");
    }
  } catch (err) {
    console.error("❌ Test error:", err.message);
  }
}

await testChatProd();
