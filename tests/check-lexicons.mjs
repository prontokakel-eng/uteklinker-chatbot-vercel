// /tests/check-lexicons.mjs
// 🔍 Testscript för att verifiera lexikonfiler (.json / .js) i /config/lexicon/
// Skriver ut filstorlek, nycklar och statistik för artiklar/negationer/common/regex
// Kompatibel med ESM och Node >= 18

import fs from "node:fs";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const lexDir = path.resolve(__dirname, "../config/lexicon");

console.log("🔍 Checking lexicons in:", lexDir, "\n");

const files = fs
  .readdirSync(lexDir)
  .filter((f) =>
    f.endsWith("_FULL_LOOKUP.json") ||
    (f.startsWith("lexicon-") && f.endsWith(".js"))
  );

if (files.length === 0) {
  console.warn("⚠️  Inga lexikonfiler hittades i /config/lexicon/");
  process.exit(0);
}

for (const file of files) {
  const abs = path.join(lexDir, file);
  try {
    const raw = fs.readFileSync(abs, "utf8");
    const size = raw.length.toLocaleString();
    let data;

    if (file.endsWith(".json")) {
      data = JSON.parse(raw);
    } else if (file.endsWith(".js")) {
      // Dynamisk import av ev. JS-baserat lexikon
      const mod = await import(url.pathToFileURL(abs));
      data = mod.default || mod.out || mod;
    }

    const keys = Object.keys(data || {});
    const articles = data?.articles?.length || 0;
    const negations = data?.negations?.length || 0;
    const common = data?.common?.length || 0;
    const regexPre = data?.regex?.prefix?.length || 0;
    const regexSuf = data?.regex?.suffix?.length || 0;

    console.log(
      `📄 ${file} (${size} bytes)\n` +
      `  keys: ${keys.join(", ") || "(none)"}\n` +
      `  sections → articles:${articles}, negations:${negations}, common:${common}, regex:[${regexPre}+${regexSuf}]`
    );
  } catch (err) {
    console.error(`❌ ${file}:`, err.message);
  }
  console.log("");
}
