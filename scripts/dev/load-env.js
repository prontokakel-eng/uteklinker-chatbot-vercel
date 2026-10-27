// /lib/load-env.js
// 🧩 Robust env loader som sanerar variabler vid inläsning
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

// Diagnostic output must not be pasted into executable source.

const envPath = path.resolve(process.cwd(), ".env.local");

// 🧹 Steg 1: Läs in .env.local om den finns
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");

  // Ta bort BOM, CR, extra whitespace och trailing spaces
  const cleaned = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ +$/gm, "")
    .replace(/^([A-Z0-9_]+)=\1=/gm, "$1=")
    .trimEnd();

  if (cleaned !== raw) {
    fs.writeFileSync(envPath, cleaned + "\n", "utf8");
    console.log("🧹 .env.local sanerad från whitespace, CR och dubbletter");
  }

  // 🔧 CHANGED: tillåt override för att alltid prioritera lokalt env
  dotenv.config({ path: envPath, override: true });
} else {
  console.warn("⚠️ Ingen .env.local hittades i projektroten");
  dotenv.config({ override: true }); // 🔧 CHANGED: se till att även fallback tillåter override
}

// 🧩 Steg 2: Normalisera alla variabler i process.env
for (const [key, value] of Object.entries(process.env)) {
  if (typeof value === "string") {
    let v = value.trim();

    const double = new RegExp(`^${key}=`);
    if (double.test(v)) v = v.replace(double, "");

    if (key === "GCP_PRIVATE_KEY" && v.includes("BEGIN PRIVATE KEY")) {
      v = v
        .replace(/\\n/g, "\n")
        .replace(/\r/g, "")
        .replace(/"/g, "")
        .trim();

      if (v.includes("\n")) v = v.replace(/\n/g, "\\n");
    }

    process.env[key] = v;
  }
}

// 🔧 CHANGED: skydd mot gamla nycklar
if (process.env.OPENAI_API_KEY?.startsWith("sk-proj-1d")) {
  console.error(
    "🚨 OLD OpenAI key detected (sk-proj-1d...). Please update Vercel and .env.local!"
  );
  delete process.env.OPENAI_API_KEY;
}

// 🧠 Debug-utskrift
if (process.env.GCP_PRIVATE_KEY?.includes("PRIVATE KEY")) {
  console.log("✅ GCP_PRIVATE_KEY laddad och normaliserad");
}

if (!process.env.GCP_CLIENT_EMAIL && !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
  console.warn("⚠️ Ingen giltig GCP-service e-post hittades i .env");
}

export const env = process.env;
