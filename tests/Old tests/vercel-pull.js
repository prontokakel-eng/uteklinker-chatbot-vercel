import "../lib/load-env.js";
// vercel-pull.js 
import { execSync } from "child_process";
import fs from "fs";
const ENV_FILE = ".env.vercel";
function logOK(name, val) {
  console.log(`✅ ${name} OK (${String(val || "").length} tecken)`);
}
try {
  console.log("⬇️  Hämtar ENV från Vercel (production)...");
  execSync("vercel env pull .env.vercel --environment=production", { stdio: "inherit" });
  console.log("🧹 Städar .env.vercel ...");
  let content = fs.readFileSync(ENV_FILE, "utf8");
  const lines = content.split(/\r?\n/).filter(Boolean);
  const cleaned = lines.map((line) => {
    if (/^\s*#/.test(line) || !line.includes("=")) return line.trim();
    const [key, ...rest] = line.split("=");
    let value = rest.join("=").trim();
    // Ta bort inramande citattecken om hela värdet är i "..."
    value = value.replace(/^"(.*)"$/s, "$1");
    // Normalisera escaped radslut
    value = value.replace(/\\r\\n/g, "\\n");
    // Ta bort riktiga CR
    value = value.replace(/\r/g, "");
    // Ta bort bokstavliga \n och \t i slutet (VIKTIGT för SHEET_ID m.fl.)
    value = value.replace(/\\n+$/, "").replace(/\\t+$/, "");
    // Trimma whitespace
    value = value.trim();
    return `${key}=${value}`;
  }).join("\n");
  fs.writeFileSync(ENV_FILE, cleaned, "utf8");
  console.log("✅ .env.vercel sanerad och sparad.");
  // Verifiera att vi faktiskt kan läsa allt
  dotenv.config({ path: ENV_FILE });
  const mustHave = [
    "GCP_PROJECT_ID",
    "GCP_PRIVATE_KEY_ID",
    "GCP_CLIENT_EMAIL",
    "GCP_CLIENT_ID",
    "GCP_PRIVATE_KEY",
    "OPENAI_API_KEY",
    "SHEET_ID",
    "USE_FUZZY",
  ];
  console.log("🔍 Verifierar laddade variabler (via dotenv)...");
  for (const key of mustHave) {
    const val = process.env[key];
    if (!val) {
      console.error(`❌ ${key} saknas eller är tom!`);
    } else {
      logOK(key, val);
    }
  }
  console.log("🎉 Klar. Kör nu dina tester igen.");
} catch (err) {
  console.error("💥 Fel:", err.message);
  process.exit(1);
}
