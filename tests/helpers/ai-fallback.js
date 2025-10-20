import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const g = globalThis;

const envPath = path.resolve(process.cwd(), ".env.local");

// 🧠 Global miljödiagnostik – körs direkt vid laddning
if (!g.__envDiagShown) {
  g.__envDiagShown = true;

  const keys = [
    "OPENAI_API_KEY",
    "OPENAI_PROJECT_ID",
    "GCP_CLIENT_EMAIL",
    "GCP_PRIVATE_KEY_ID",
    "SHEET_ID_MAIN",
    "VERCEL",
  ];

  const getOrigin = (key) => {
    if (process.env.VERCEL === "1") return "Vercel CLI";
    if (process.env[key] && process.env[key].includes("sk-proj")) return ".env.local";
    if (process.env[key]) return "System/Powershell";
    return "❌ missing";
  };

  console.log("🧩 ENV DIAGNOSTIC REPORT ------------------------------");
  for (const k of keys) {
    const val = process.env[k];
    const masked = val
      ? val.startsWith("sk-")
        ? val.slice(0, 10) + "..."
        : val.slice(0, 6) + "..."
      : "undefined";
    console.log(`🔑 ${k.padEnd(20)} = ${masked.padEnd(16)} | src: ${getOrigin(k)}`);
  }
  console.log("------------------------------------------------------");
}

// 🧹 Steg 1: Läs in .env.local om den finns
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  dotenv.config({ path: envPath, override: true });
  // 🔧 NYTT: märk att OPENAI-variablerna kommer från .env.local denna körning
  if (process.env.OPENAI_API_KEY) {
    process.env.__OPENAI_SOURCE = ".env.local";
  }
} else {
  console.warn("⚠️ Ingen .env.local hittades i projektroten");
  dotenv.config({ override: true });
}

if (process.env.VERCEL === "1" && process.env.OPENAI_API_KEY) {
  process.env.__OPENAI_SOURCE = "vercel";
}

if (process.env.OPENAI_API_KEY?.startsWith("sk-proj-1d")) {
  console.error(
    "🚨 OLD OpenAI key detected (sk-proj-1d...). Please update Vercel and .env.local!"
  );
  delete process.env.OPENAI_API_KEY;
}
