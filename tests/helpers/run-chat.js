import fetch from "node-fetch"; // node-fetch v2.x

export async function runChat(input) {
  if (!input) {
    throw new Error("runChat called without input!");
  }

  const url = "http://localhost:3000/api/chat";
  const payload = { text: input }; // ✅ ENDAST text – testMode styrs i backend

  console.log("\n📤 Sending request to:", url);
  console.log("📤 Method: POST");
  console.log("📤 Headers:", { "Content-Type": "application/json" });
  console.log("📤 Body:", JSON.stringify(payload, null, 2));

  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("💥 Network/Fetch error:", err);
    throw err;
  }

  console.log("📥 Raw response status:", res.status);
  const text = await res.text();
  console.log("📥 Raw response body:", text);

  let data;
  try {
    data = JSON.parse(text);
  } catch (err) {
    console.error("💥 Failed to parse JSON:", err);
    data = { parseError: err.message, raw: text };
  }

  if (!res.ok) {
    console.error("❌ Chat API error", res.status, data);
    throw new Error(`Chat API error ${res.status}`);
  }

  return data;
}
