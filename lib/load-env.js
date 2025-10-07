// /lib/load-env.js
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 🔑 Ladda .env.local
const result = dotenv.config({ path: resolve(__dirname, "../.env.local") });

if (result.parsed) {
  for (const key of Object.keys(result.parsed)) {
    process.env[`__FROM_FILE_${key}`] = "1";
  }
  console.log(`📥 Loaded ${Object.keys(result.parsed).length} vars från .env.local`);
} else {
  console.log("ℹ️ Ingen .env.local hittad eller inga variabler laddades");
}

// 🧹 Sanera och normalisera GCP_PRIVATE_KEY och andra värden
for (const [key, value] of Object.entries(process.env)) {
  if (typeof value !== "string") continue;
  let cleaned = value.trim();

  // Ta bort dubblett-prefix "VAR=VAR="
  const double = new RegExp(`^${key}=`);
  if (double.test(cleaned)) cleaned = cleaned.replace(double, "");

  // Specifik fix för GCP_PRIVATE_KEY
  if (key === "GCP_PRIVATE_KEY") {
    // Om värdet innehåller faktiska radbrytningar -> konvertera till \n
    if (cleaned.includes("\n") && !cleaned.includes("\\n")) {
      console.warn("⚠️ ENV var 'GCP_PRIVATE_KEY' hade verkliga radbrytningar, korrigerar automatiskt.");
      cleaned = cleaned.replace(/\r/g, "").replace(/\n/g, "\\n");
    }

    // Om värdet saknar \n helt, logga varning
    if (!cleaned.includes("\\n")) {
      console.warn("⚠️ GCP_PRIVATE_KEY verkar sakna radbrytningar (\\n), kontrollera .env.local-formatet.");
    }

    // Rensa bort dubbla citattecken
    cleaned = cleaned.replace(/^"+|"+$/g, "");
  }

  process.env[key] = cleaned;
}

// 🔍 Helper för att skriva ut prefix/suffix
function logVar(name) {
  const val = process.env[name];
  if (!val) {
    console.warn(`⚠️ ${name} saknas i Environment Variables`);
    return;
  }
  const prefix = val.slice(0, 5);
  const suffix = val.slice(-5);
  const source = process.env[`__FROM_FILE_${name}`] ? ".env file" : "system/registry";
  console.log(`🔑 ${name} = ${prefix}...${suffix} (len=${val.length}, source=${source})`);
}

// === Logga ALLA kritiska env-variabler ===
[
  "OPENAI_API_KEY",
  "OPENAI_PROJECT_ID",
  "SHEET_ID",
  "SHEET_ID_MAIN",
  "GCP_CLIENT_EMAIL",
  "GCP_PROJECT_ID",
  "GCP_PRIVATE_KEY_ID",
  "GCP_PRIVATE_KEY"
].forEach(logVar);

// ✅ Exportera miljön
export const env = process.env;
export default process.env;
