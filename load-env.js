// /lib/load-env.js
// 🧩 Robust env loader som sanerar variabler vid inläsning
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

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
    .replace(/^([A-Z0-9_]+)=\1=/gm, "$1=") // tar bort dubbel VAR=VAR=
    .trimEnd();

  if (cleaned !== raw) {
    fs.writeFileSync(envPath, cleaned + "\n", "utf8");
    console.log("🧹 .env.local sanerad från whitespace, CR och dubbletter");
  }

  dotenv.config({ path: envPath });
} else {
  console.warn("⚠️ Ingen .env.local hittades i projektroten");
  dotenv.config();
}

// 🧩 Steg 2: Normalisera alla variabler i process.env
for (const [key, value] of Object.entries(process.env)) {
  if (typeof value === "string") {
    let v = value.trim();

    // Fixar nycklar som råkat få "VAR=VAR=" prefix
    const double = new RegExp(`^${key}=`);
    if (double.test(v)) {
      v = v.replace(double, "");
    }

    // Specifik fix för GCP_PRIVATE_KEY
    if (key === "GCP_PRIVATE_KEY" && v.includes("BEGIN PRIVATE KEY")) {
      // Byt ut verkliga radbrytningar mot \n, ta bort dubbla \n och citattecken
      v = v
        .replace(/\\n/g, "\n") // tolka dubbel-escaped \n
        .replace(/\r/g, "")
        .replace(/"/g, "")
        .trim();

      // Om filen innehåller riktiga radbrytningar, konvertera till escaped form
      if (v.includes("\n")) {
        v = v.replace(/\n/g, "\\n");
      }
    }

    process.env[key] = v;
  }
}

// 🧠 Debug-utskrift (endast om GCP-variabler finns)
if (process.env.GCP_PRIVATE_KEY?.includes("PRIVATE KEY")) {
  console.log("✅ GCP_PRIVATE_KEY laddad och normaliserad");
}

if (!process.env.GCP_CLIENT_EMAIL && !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
  console.warn("⚠️ Ingen giltig GCP-service e-post hittades i .env");
}

export const env = process.env;
