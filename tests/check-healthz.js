// tests/check-healthz.js
import fetch from "node-fetch";

const urls = [
  "http://localhost:3000/api/healthz",
  "https://uteklinker-chatbot-vercel.vercel.app/api/healthz"
];

for (const url of urls) {
  console.log(`\n🌍 Testar ${url}`);
  try {
    const res = await fetch(url);
    const text = await res.text();
    console.log(`✅ Status ${res.status}`);
    console.log(`📦 Svar: ${text}`);
  } catch (err) {
    console.error(`❌ Fel vid fetch:`, err.message);
  }
}
