// lib/load-env.js
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

const envPath = path.resolve(process.cwd(), ".env.local");

// Läs & sanera .env.local (om den finns)
if (fs.existsSync(envPath)) {
  const raw = fs.readFileSync(envPath, "utf8");
  const cleaned = raw
    .replace(/^\uFEFF/, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/ +$/gm, "")
    .replace(/^([A-Z0-9_]+)=\1=/gm, "$1=")
    .trimEnd();
  if (cleaned !== raw) fs.writeFileSync(envPath, cleaned + "\n", "utf8");
  dotenv.config({ path: envPath, override: true });
} else {
  dotenv.config({ override: true });
}

// Normalisera GCP-nyckel (stöd för både radbrytningar och citattecken)
if (process.env.GCP_PRIVATE_KEY?.includes("BEGIN PRIVATE KEY")) {
  let v = process.env.GCP_PRIVATE_KEY
    .replace(/\\n/g, "\n")
    .replace(/\r/g, "")
    .replace(/"/g, "")
    .trim();
  // skriv tillbaka med escaped \n så Google-sdk klarar JSON
  if (v.includes("\n")) v = v.replace(/\n/g, "\\n");
  process.env.GCP_PRIVATE_KEY = v;
}

// Mjuk varning om service-kontots e-post saknas
if (!process.env.GCP_CLIENT_EMAIL && !process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
  console.warn("⚠️ Ingen giltig GCP service account e-post i .env");
}

export const env = process.env;
