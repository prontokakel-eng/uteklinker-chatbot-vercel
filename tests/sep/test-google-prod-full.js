import "../lib/load-env.js";
// tests/test-google-prod-full.js
// Ladda prod-variabler från .env.vercel
import fetch from "node-fetch";
import { google } from "googleapis";
const PROD_URL = "https://uteklinker-chatbot-vercel.vercel.app";
// --- util ---
const clean = (v) => (v || "").replace(/^"|"$/g, "").trim();
function showVar(name, value, maxLen = 80) {
  if (!value) {
    console.warn(`⚠️ ${name} saknas!`);
    return;
  }
  const cleaned = clean(value).replace(/\\n/g, "\n");
  console.log(`\n🔍 ${name}`);
  console.log("Raw start:", value.substring(0, maxLen));
  console.log("Raw end  :", value.substring(value.length - maxLen));
  console.log("Cleaned start:", cleaned.substring(0, maxLen));
  console.log("Cleaned end  :", cleaned.substring(cleaned.length - maxLen));
}
async function testEnvAndAuth() {
  console.log("=== ENV & GoogleAuth test ===");
  showVar("GCP_PROJECT_ID", process.env.GCP_PROJECT_ID);
  showVar("GCP_PRIVATE_KEY_ID", process.env.GCP_PRIVATE_KEY_ID);
  showVar("GCP_CLIENT_EMAIL", process.env.GCP_CLIENT_EMAIL);
  showVar("GCP_CLIENT_ID", process.env.GCP_CLIENT_ID);
  const pk = process.env.GCP_PRIVATE_KEY;
  if (!pk) {
    console.error("❌ GCP_PRIVATE_KEY saknas helt!");
  } else {
    console.log("\n🔑 GCP_PRIVATE_KEY length:", pk.length);
    console.log("Starts with:", pk.substring(0, 40));
    console.log("Ends with:", pk.substring(pk.length - 40));
    console.log("Contains \\n ?", pk.includes("\\n"));
  }
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        type: "service_account",
        project_id: clean(process.env.GCP_PROJECT_ID),
        private_key_id: clean(process.env.GCP_PRIVATE_KEY_ID),
        private_key: (process.env.GCP_PRIVATE_KEY || "")
          .replace(/\\n/g, "\n")
          .replace(/^"|"$/g, "")
          .trim(),
        client_email: clean(process.env.GCP_CLIENT_EMAIL),
        client_id: clean(process.env.GCP_CLIENT_ID),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    await auth.getClient();
    console.log("\n✅ GoogleAuth klient skapad utan fel!");
    return auth;
  } catch (err) {
    console.error("\n❌ GoogleAuth error:", err.message);
    return null;
  }
}
async function testProdChat() {
  console.log("\n=== PROD /api/chat test ===");
  const res = await fetch(`${PROD_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text: "Hur beställer jag klinker?", lang: "SE" }),
  });
  const raw = await res.text();
  console.log("status:", res.status);
  console.log("raw response:", raw);
  try {
    const json = JSON.parse(raw);
    console.log("json:", json);
  } catch {
    console.warn("⚠️ Kunde inte parsa JSON.");
  }
}
async function testSheets(auth) {
  console.log("\n=== Google Sheets FAQ_SE test ===");
  if (!auth) {
    console.warn("⚠️ Hoppar över Sheets-test (auth misslyckades)");
    return;
  }
  try {
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEET_ID,
      range: "FAQ_SE!A:B",
    });
    const rows = res.data.values || [];
    console.log(`✅ Hittade ${rows.length} rader i FAQ_SE`);
    if (rows.length > 0) {
      console.log("Första raden:", rows[0]);
    }
  } catch (err) {
    console.error("❌ Sheets error:", err.message);
  }
}
(async () => {
  const auth = await testEnvAndAuth();
  await testProdChat();
  await testSheets(auth);
})();
