import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import readline from "readline";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOG_DIR = path.join(process.cwd(), "tests", "logs");
if (!fs.existsSync(LOG_DIR)) {
  console.error("❌ Ingen loggkatalog hittad:", LOG_DIR);
  process.exit(1);
}

// 🧩 Hitta senaste loggfil (torture-v4-*.log)
const logFiles = fs.readdirSync(LOG_DIR)
  .filter(f => f.startsWith("torture-v4-") && f.endsWith(".log"))
  .map(f => ({ name: f, time: fs.statSync(path.join(LOG_DIR, f)).mtimeMs }))
  .sort((a, b) => b.time - a.time);

if (logFiles.length === 0) {
  console.error("❌ Ingen torture-logg hittades.");
  process.exit(1);
}

const latest = logFiles[0].name;
const filePath = path.join(LOG_DIR, latest);
console.log(`📖 Analyserar: ${latest}`);

const rl = readline.createInterface({
  input: fs.createReadStream(filePath, { encoding: "utf8" }),
  crlfDelay: Infinity,
});

let total = 0;
const categories = {};
const languages = {};
const entries = [];

function addCount(map, key) {
  map[key] = (map[key] || 0) + 1;
}

for await (const line of rl) {
  if (!line.includes("🟥") && !line.includes("🔴")) continue;

  total++;
  // Exempel: [BLOCK] lottery scam free money → got=EN via=ai, expected=FILTER 🔴
  const match = line.match(/^\[(.+?)\]\s+(.*?)\s+→\s+got=(.+?)\s+via=(.+?),\s+expected=(.+?)\s+(?:🟥|🔴)/);
  if (match) {
    const [, category, input, got, via, expected] = match.map(s => s.trim());
    addCount(categories, category);
    addCount(languages, expected);
    entries.push({ category, input, got, expected, via });
  }
}

console.log(`\n🧾 Totala mismatchar: ${total}`);
console.log("\n📊 Mismatchar per kategori:");
console.table(categories);
console.log("📊 Mismatchar per språk:");
console.table(languages);

// 💾 Skriv CSV
const csvPath = path.join(LOG_DIR, `torture-mismatch-report-${new Date().toISOString().replace(/[:.]/g, "-")}.csv`);
const header = "category,input,got,expected,via\n";
const csv = header + entries.map(e =>
  `"${e.category}","${e.input.replace(/"/g, '""')}","${e.got}","${e.expected}","${e.via}"`
).join("\n");

fs.writeFileSync(csvPath, csv, "utf8");
console.log(`\n✅ Rapport sparad: ${csvPath}`);
