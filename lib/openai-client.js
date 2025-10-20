// /lib/openai-client.js
import OpenAI from "openai";
import { validateEnv } from "./env-check.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { env } from "./load-env.js"; // ✅ använder robust loader

const g = globalThis;

const __dirname = dirname(fileURLToPath(import.meta.url));

let openaiInstance;

// --- OpenAI Client Factory ---
export function getOpenAIClient(caller = "unknown") {
  if (openaiInstance) {
    console.log(`♻️ OpenAI client reused (called from: ${caller})`);
    return openaiInstance;
  }

  validateEnv([
    ["OPENAI_API_KEY"],
    ["OPENAI_PROJECT_ID"],
  ]);

  // 🔧 CHANGED: gör tydlig loggning om var nyckeln kommer ifrån
  const apiKey = env.OPENAI_API_KEY;
  const project =
    env.OPENAI_PROJECT_ID ||
    env.OPENAI_PROJECT ||
    env.OPENAI_DEFAULT_PROJECT;

  const origin =
    process.env.VERCEL === "1"
      ? "Vercel (CLI injected)"
      : process.env.OPENAI_API_KEY
      ? "System/Powershell"
      : ".env.local";

  if (!apiKey) {
    throw new Error(
      `❌ Ingen giltig OPENAI_API_KEY hittades (källa: ${origin}). Kontrollera .env.local eller Vercel env.`
    );
  }

  console.log("[openai-client] 🔑 Using key source:", origin);
  console.log("[openai-client] Using:", {
    apiKey: apiKey ? apiKey.slice(0, 10) + "..." : "❌ undefined",
    project,
  });

  // 🔧 CHANGED: sanity check mot gamla nycklar
  if (apiKey.startsWith("sk-proj-1d")) {
    throw new Error("🚨 Old/deprecated OpenAI key detected (sk-proj-1d...). Update required!");
  }
  
// 🧠 Snapshot-diagnostik – endast vid första init av OpenAI-klient
if (!g.__openaiDiagShown) {
  g.__openaiDiagShown = true;

  console.log("🧩 OPENAI CLIENT ENV SNAPSHOT -----------------------");
  const keyPrefix = apiKey ? apiKey.slice(0, 10) + "..." : "❌ undefined";
  const origin =
    process.env.VERCEL === "1"
      ? "Vercel CLI"
      : process.env.OPENAI_API_KEY
      ? "System/Powershell"
      : ".env.local";

  console.log(`🔑 Source: ${origin}`);
  console.log(`🔑 OPENAI_API_KEY prefix: ${keyPrefix}`);
  console.log(`🔑 OPENAI_PROJECT_ID: ${project || "❌ missing"}`);
  console.log(`🔑 NODE_ENV: ${process.env.NODE_ENV || "undefined"}`);
  console.log("------------------------------------------------------");
}

  openaiInstance = new OpenAI({ apiKey, project });
  console.log("[openai-client] ✅ OpenAI client initialized (project key)");

  return openaiInstance;
}
