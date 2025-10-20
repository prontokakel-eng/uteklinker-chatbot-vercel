// test-api.js
import fetch from "node-fetch";

async function testDetectLang() {
  const res = await fetch("http://localhost:3000/api/detect-lang", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Hello world" })
  });
  console.log("detect-lang status:", res.status);
  console.log("detect-lang json:", await res.json());
}

async function testChat() {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Hur beställer jag klinker?", lang: "SE" })
  });
  console.log("chat status:", res.status);
  console.log("chat json:", await res.json());
}

await testDetectLang();
await testChat();
