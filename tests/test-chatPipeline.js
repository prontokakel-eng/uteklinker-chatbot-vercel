// tests/test-chatPipeline.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { chatPipeline } from "../lib/chatPipeline.js";

dotenv.config({ path: ".env.local" });   // laddar rätt fil

// === Setup loggfil ===
const logDir = path.resolve("./tests/logs");
const logFile = path.join(logDir, "test-chat-log.txt");

// Se till att katalogen finns
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Nollställ loggfilen vid varje körning
fs.writeFileSync(logFile, "", { encoding: "utf8" });

// Skriv logg både till fil och console
function log(...args) {
  const msg = args.map(a =>
    typeof a === "object" ? JSON.stringify(a, null, 2) : String(a)
  ).join(" ");

  console.log(msg);
  fs.appendFileSync(logFile, msg + "\n", { encoding: "utf8" });
}

async function runTests() {
  log("=== TEST START ===");
  log("DEBUG ENV:", {
    OPENAI: process.env.OPENAI_API_KEY ? "✅" : "❌",
    SHEET_ID: process.env.SHEET_ID_MAIN || process.env.SHEET_ID ? "✅" : "❌",
    GCP_EMAIL: process.env.GCP_CLIENT_EMAIL ? "✅" : "❌",
    GCP_KEY: process.env.GCP_PRIVATE_KEY ? "✅" : "❌",
  });

  log("\n=== Test 1: FAQ-träff (cut-off) ===");
  const res1 = await chatPipeline("Vilka färger finns i serien Lava?");
  log("Svar:", res1);

  log("\n=== Test 2: FAQ uppföljning (ja = fulltext) ===");
  const res2 = await chatPipeline("ja");
  log("Svar:", res2);

  log("\n=== Test 3: Ingen FAQ-träff → AI fallback ===");
  const res3 = await chatPipeline("Hur påverkar fullmånen mitt kakelval?");
  log("Svar:", res3);

  log("\n=== Test 4: Engelska fråga (FAQ/AI fallback) ===");
  const res4 = await chatPipeline("What colors are available in Lava?");
  log("Svar:", res4);

  log("\n=== Test 5: Tvångskör språkdetektion med AI-fallback ===");
  const res5 = await chatPipeline("🤖🤖🤖");
  log("Svar:", res5);

  log("\n=== Test 6: Ny fråga efter att klienterna redan initierats ===");
  const res6 = await chatPipeline("Vilka färger finns i serien Albero?");
  log("Svar:", res6);

  log("=== TEST END ===");
}

runTests().catch(err => log("❌ Test failed:", err));
