import "../lib/load-env.js";
// /tests/test-cache.js
dotenv.config({ path: "../.env.vercel" });
import fetch from "node-fetch";
const URL = "http://localhost:3000/api/faq-data?lang=SE&reload=false";
async function measureRequest(url) {
  const start = Date.now();
  const res = await fetch(url);
  const text = await res.text();
  const timeMs = Date.now() - start;
  return { timeMs, length: text.length };
}
async function main() {
  console.log(`⏱️ Testar cache mot ${URL}`);
  const results = [];
  for (let i = 1; i <= 5; i++) {
    const result = await measureRequest(URL);
    if (i === 1) {
      console.log(`🕒 Första request: ${result.timeMs} ms (inkl. Google Sheets)`);
    } else {
      console.log(`⚡ Cache-request ${i}: ${result.timeMs} ms`);
    }
    results.push(result);
    await new Promise((r) => setTimeout(r, 1000));
  }
  const avg = results.reduce((sum, r) => sum + r.timeMs, 0) / results.length;
  console.log(`✅ Snittid: ${avg.toFixed(1)} ms`);
}
main().catch((err) => {
  console.error("💥 Testfel:", err);
  process.exit(1);
});
