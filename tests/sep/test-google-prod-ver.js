// tests/test-google-prod-ver.js
import fetch from "node-fetch";

const PROD_URL = "https://uteklinker-chatbot-vercel.vercel.app/api/chat"; 
// Vi testar egentligen Google Sheets via /api/chat, 
// men för att isolera kan du byta till en separat test-endpoint senare.

async function testFaq() {
  console.log("🔍 Testar FAQ-laddning i PROD...");

  try {
    const res = await fetch("https://uteklinker-chatbot-vercel.vercel.app/api/test-google");
    console.log("status:", res.status);

    const text = await res.text();
    console.log("raw response:", text);

    try {
      const json = JSON.parse(text);
      console.log("json:", json);
    } catch {
      console.error("⚠️ Kunde inte parsa JSON.");
    }
  } catch (err) {
    console.error("❌ Error vid fetch:", err.message);
  }
}

await testFaq();
