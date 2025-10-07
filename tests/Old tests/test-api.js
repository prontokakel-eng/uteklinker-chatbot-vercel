import fetch from "node-fetch";

async function testDetectLang() {
  const res = await fetch("http://localhost:3000/api/detect-lang", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Hello world" }),
  });
  console.log("detect-lang:", await res.json());
}

async function testChat() {
  const res = await fetch("http://localhost:3000/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "Behöver betongen förbehandlas?", lang: "SE" }),
  });
  console.log("chat:", await res.json());
}

await testDetectLang();
await testChat();
