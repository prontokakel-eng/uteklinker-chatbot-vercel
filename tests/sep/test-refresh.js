// tests/test-refresh.js
import fetch from "node-fetch";

const BASE = "http://localhost:3000";
const RUNS = 3;

async function testEndpoint(endpoint) {
  console.log(`\n⏱️ Testar cache mot ${BASE}${endpoint}`);

  for (let i = 0; i < RUNS; i++) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}${endpoint}`);
    const data = await res.json();
    const elapsed = Date.now() - t0;

    if (endpoint.includes("faq-data")) {
      console.log(
        `🔹 Request ${i + 1}: ${elapsed} ms, count: ${data.count}, faqs[]: ${Array.isArray(data.faqs) ? data.faqs.length : "N/A"}`
      );
    } else {
      console.log(
        `🔹 Request ${i + 1}: ${elapsed} ms, count: ${data.count}`
      );
    }
  }
}

async function run() {
  await testEndpoint("/api/faq?lang=SE");
  await testEndpoint("/api/faq-data?lang=SE");
}
run().catch((err) => {
  console.error("💥 Testfel:", err);
});
