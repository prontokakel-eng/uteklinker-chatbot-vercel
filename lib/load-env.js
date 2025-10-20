// /lib/load-env.js
// ENV POLICY (B):
//  LOCAL:      .env
//  TEST:       tests/.env
//  PRODUCTION: Vercel ENV only (no local .env files in prod)
//  FAIL-FAST on missing critical vars
//  HARDENED + UTF-8 SAFE
//
//  © ChatBot Project

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
import { checkOpenAIEnvConflicts } from "./check-openai-env.js";

function safeLog(msg) {
  if (process.env.NODE_ENV !== "test") {
    console.log(msg);
  }
}

function applyEnvFile(envPath, override = false) {
  if (!fs.existsSync(envPath)) {
    safeLog(`[load-env] ℹ️ no .env file at: ${envPath}`);
    return;
  }
  try {
    dotenv.config({ path: envPath, override });
    safeLog(`[load-env] ✅ loaded: ${envPath}`);
  } catch (err) {
    console.error("[load-env] ❌ dotenv parse error:", err);
    process.exit(1);
  }
}

export function loadEnv() {
  const cwd = process.cwd();

  try {
    if (process.env.NODE_ENV === "test") {
      applyEnvFile(path.join(cwd, "tests/.env"), true);
    } else if (process.env.VERCEL === "1") {
      safeLog("[load-env] 🚀 using Vercel ENV only");
    } else {
      applyEnvFile(path.join(cwd, ".env"));
    }

    checkOpenAIEnvConflicts();

    const criticalVars = [
      "OPENAI_API_KEY",
      "OPENAI_PROJECT_ID",
      "GCP_CLIENT_EMAIL",
      "GCP_PRIVATE_KEY",
      "SHEET_ID_MAIN"
    ];
    const missing = criticalVars.filter(v => !process.env[v] || process.env[v].trim() === "");
    if (missing.length) {
      console.error("❌ Missing critical env vars:\n - " + missing.join("\n - "));
      process.exit(1);
    }

    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value !== "string") continue;
      let cleaned = value.trim();
      if (key === "GCP_PRIVATE_KEY") {
        cleaned = cleaned.replace(/\r/g, "").replace(/\n/g, "\\n").replace(/^"+|"+$/g, "");
      }
      process.env[key] = cleaned;
    }

  } catch (err) {
    console.error("[load-env] ❌ fatal env loader error:", err);
    process.exit(1);
  }
}

export const env = process.env;
export default process.env;
