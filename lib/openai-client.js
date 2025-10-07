import OpenAI from "openai";
import { validateEnv } from "./env-check.js";

let client = null;

export function getOpenAIClient(caller = "unknown") {
  validateEnv(["OPENAI_API_KEY"]); // ✅ nu ligger checken här

  if (!client) {
    client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    console.log(`🔑 OpenAI client initialized (first call from: ${caller})`);
  } else {
    console.log(`♻️ OpenAI client reused (called from: ${caller})`);
  }
  return client;
}
