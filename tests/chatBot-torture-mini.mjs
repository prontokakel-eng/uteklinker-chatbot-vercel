import "../lib/load-env.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { chatPipeline } from "../lib/chatPipeline.js";
import { detectLangRulesOnly } from "../lib/detect-lang-rules.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
console.log(`📝 Running script: ${__filename}`);

// === Loggning ===
const LOG_DIR = path.join(process.cwd(), "tests", "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const LOG_FILE = path.join(LOG_DIR, `mini-torture-${timestamp}.log`);
function logToFile(line) { fs.appendFileSync(LOG_FILE, line + "\n", "utf8"); }

console.log(`🗒️ Logfile: ${LOG_FILE}`);
logToFile(`=== MINI TORTURE START ${new Date().toISOString()} ===`);

const CASES_FILE = process.env.TEST_CASES_FILE || "mini-torture-2-questions.json";
const casesPath = path.join(__dirname, CASES_FILE);
const testCases = JSON.parse(fs.readFileSync(casesPath, "utf8"));
console.log(`📂 Using test cases: ${casesPath}`);

const LANGS = ["SE", "EN", "DA", "DE"];
let mismatches = 0;
let mismatchCases = [];

// -----------------------------
// 🔧 Unika IPs per testfall (bypass false positives from rate-limiter)
// -----------------------------
const RUN_ID = Date.now().toString(36);
let SEQ = 0;
const nextIp = (tag) =>
  `test-ip-${RUN_ID}-${SEQ++}-${String(tag).replace(/[^a-z0-9:_-]/gi, "-")}`;

// === Runner ===
async function runPipeline(input, ipTag = "case") {
  const ip = nextIp(ipTag);
  const req = { method: "POST", body: { text: input }, ip, headers: { "x-forwarded-for": ip } };
  return await chatPipeline(req, {});
}

function normalizeCase(it, expected) {
  if (typeof it === "string") return { input: it, expected };
  return { input: it.input, expected: it.expected || expected };
}

// === Main ===
(async () => {
  console.log("🚀 Running MINI torture test");
  logToFile("🚀 Running MINI torture test");

  const allTypes = [...LANGS, "FUZZY", "GIBBERISH", "LONG", "BLOCK", "GREETING", "RELEVANCE"];

  for (const type of allTypes) {
    for (const [i, it] of (testCases[type] || []).entries()) {
      const { input, expected } = normalizeCase(it, type === "FUZZY" ? "SE" : "FILTER");

      const pre = await detectLangRulesOnly(input);
      const res = await runPipeline(input, `${type}:${i}`);
      const got = res.lang || "UNKNOWN";
      const reply = typeof res.reply === "object" ? JSON.stringify(res.reply) : res.reply || "(no reply)";


      // 🧠 Ny logik: godkänn greeting & filter enligt nya pipeline-regler
      const ok =
        got === expected ||
        (res.source === "GREETING" && ["SE", "EN", "DA", "DE"].includes(expected)) ||
        (res.source === "FILTER" && ["FILTER", "BLOCK", "LONG"].includes(type));

      if (!ok) {
        mismatches++;
        mismatchCases.push({
          type,
          index: i,
          input,
          got,
          expected,
          via: res.via,
          source: res.source,
        });
      }

      const mark = ok ? "🟢" : "🔴";
      const line = `[${type}] ${input} → got=${got} via=${res.via || "?"}, expected=${expected}, source=${res.source || "-"} ${mark}`;
      console.log(line);
      logToFile(line);

      if (res.source === "AI_FALLBACK") {
        logToFile(`🤖 AI fallback used for input="${input}"`);
      }
    }
  }

  // === Summary ===
  const summary = `\n🟩 MINI torture klart. Totala mismatchar: ${mismatches}`;
  const details = `⚠️ PreDetect≠ChatDetect inte tillämpligt i mini.`;
  console.log(summary);
  console.log(details);
  logToFile(summary);
  logToFile(details);

  if (mismatchCases.length) {
    logToFile("=== MISMATCHED CASES ===");
    mismatchCases.forEach((m) =>
      logToFile(
        `[${m.type} #${m.index}] "${m.input}" → got=${m.got}, expected=${m.expected}, via=${m.via}, source=${m.source}`
      )
    );
  }

  logToFile(`=== END ${new Date().toISOString()} ===\n`);
})();
