// /lib/openai-client.js
import OpenAI from "openai";
import { validateEnv } from "./env-check.js";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

// ✅ Gör alltid absolut path till .env.local
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "../.env.local");
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.warn("[openai-client] ⚠️ Kunde inte läsa .env.local:", result.error);
} else {
  console.log(`[openai-client] 📥 Loaded env from ${envPath}`);
  console.log("[openai-client] OPENAI_API_KEY starts with:", process.env.OPENAI_API_KEY?.slice(0, 10));
}

let openaiInstance;

export function getOpenAIClient(caller = "unknown") {
  if (openaiInstance) {
    console.log(`♻️ OpenAI client reused (called from: ${caller})`);
    return openaiInstance;
  }

  validateEnv([
    ["OPENAI_API_KEY"],
    ["OPENAI_PROJECT_ID"],
  ]);

  const apiKey = process.env.OPENAI_API_KEY;
  // ✅ Hanterar både nya och gamla namn på env
  const project =
  process.env.OPENAI_PROJECT_ID ||
  process.env.OPENAI_PROJECT ||
  process.env.OPENAI_DEFAULT_PROJECT;

  console.log("[openai-client] Using:", {
    apiKey: apiKey ? apiKey.slice(0, 10) + "..." : "❌ undefined",
    project,
  });

  openaiInstance = new OpenAI({
    apiKey,
    project, // ✅ Nödvändigt för project-bound keys
  });

  console.log("[openai-client] ✅ OpenAI client initialized (project key)");
  return openaiInstance;
}
