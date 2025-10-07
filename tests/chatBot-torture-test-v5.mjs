// 🧪 tests/chatBot-torture-test-v5.mjs
// Torture runner v5 — ESM, /lib-struktur, IP-override, OpenAI/Backend-fallback
//
// Kör 10 varv mot dina testfall (CSV: ExpectedLang,Input).
// - Steg per rad: Gate → DetectLangCore → (valfritt) Backend/AI-fallback
// - Loggar till tests/logs/torture-run-YYYY-MM-DD.log
// - Sparar summering till tests/logs/torture-summary-YYYY-MM-DD.{json,csv}
//
// Usage:
//   node tests/chatBot-torture-test-v5.mjs [path/to/test.csv]
//
// Env som stöds (alla valfria):
//   CHAT_API_URL=http://localhost:3000/api/chat   (default)
//   TEST_OVERRIDE_IP=83.0.0.1                     (om du vill forcera IP)
//   MODE=backend|local                            (default backend)
//   OPENAI_API_KEY=...                            (för backend/AI)
//   GCP_CLIENT_EMAIL=..., GCP_PRIVATE_KEY=...     (för FAQ/SHEETS om din backend kräver)
//
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// ESM helpers
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

// Lokala lib-importer (ESM)
import { gateMessage } from "../lib/gate.js";
import { detectLangCore } from "../lib/detect-lang-core.js";
// chatPipeline (för MODE=local — kör utan HTTP om du vill testa direkt i kod)
import { chatPipeline } from "../lib/chatPipeline.js";
// Logger (valfritt: om saknas, fallback till console)
let logToFile;
try {
  const { logMessage } = await import("../lib/logger.js");
  logToFile = (fname, line) => logMessage(fname, line);
} catch {
  logToFile = (_fname, line) => console.log(line);
}

// Global fetch finns i Node 20+. Om äldre node, importera 'node-fetch'.

// Konfig
const MODE = (process.env.MODE || "backend").toLowerCase(); // "backend" | "local"
const CHAT_API_URL = process.env.CHAT_API_URL || "http://localhost:3000/api/chat";
const OVERRIDE_IP = process.env.TEST_OVERRIDE_IP || null;
const RUNS = 10;

// Input CSV
const csvPath = process.argv[2] || path.join(__dirname, "data", "detect-lang-samples.csv");

// Output-loggar
const LOG_DIR = path.join(__dirname, "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const day = new Date().toISOString().slice(0, 10);
const RUN_LOG = path.join(LOG_DIR, `torture-run-${day}.log`);
const SUMMARY_JSON = path.join(LOG_DIR, `torture-summary-${day}.json`);
const SUMMARY_CSV = path.join(LOG_DIR, `torture-summary-${day}.csv`);

// Hjälpare
function parseCSV(content) {
  const lines = content.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  const rows = [];
  for (const line of lines) {
    if (!line || line.startsWith("#")) continue;
    // koma eller tab
    const parts = line.split(",").length > 1 ? line.split(",") : line.split("\t");
    if (parts.length < 2) continue;
    const expected = parts[0].trim();
    const input = parts.slice(1).join(",").trim();
    rows.push({ expected, input });
  }
  return rows;
}

// Om ingen CSV, bygg standardfall från detect-lang-rules.js
async function buildDefaultRows() {
  const { testSamples } = await import("../lib/detect-lang-rules.js");
  const rows = [];
  for (const [lang, samples] of Object.entries(testSamples)) {
    for (const s of samples) rows.push({ expected: lang, input: s });
  }
  return rows;
}

async function callBackend(message, ip) {
  const body = {
    message,
    ip,
    // valfria fält beroende på din API-handler
    mode: "torture",
    meta: { source: "torture-v5", ts: new Date().toISOString() }
  };
  try {
    const res = await fetch(CHAT_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    return { ok: true, data, status: res.status };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

function toCsvLine(obj) {
  const esc = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [
    esc(obj.iter),
    esc(obj.expected),
    esc(obj.input),
    esc(obj.gateLang),
    esc(obj.coreLang),
    esc(obj.coreVia),
    esc(obj.coreConf),
    esc(obj.backendStatus),
    esc(obj.backendLang ?? ""),
    esc(obj.viaCombined ?? ""),
    esc(obj.passFail)
  ].join(",");
}

async function main() {
  // Ladda testfall
  let rows = [];
  if (fs.existsSync(csvPath)) {
    const content = fs.readFileSync(csvPath, "utf8");
    rows = parseCSV(content);
  } else {
    rows = await buildDefaultRows();
  }

  // Simulerade IP-pool (rotera så du ser gate/ip-effekter)
  const ipPool = OVERRIDE_IP ? [OVERRIDE_IP] : ["127.0.0.1", "83.0.0.1", "82.0.0.1", "8.8.8.8", "172.16.0.1"];

  const summary = [];
  let pass = 0, fail = 0, partial = 0;

  for (let iter = 1; iter <= RUNS; iter++) {
    const ip = ipPool[(iter - 1) % ipPool.length];
    const stamp = new Date().toISOString();
    const header = `\n--- TORTURE RUN ${iter}/${RUNS} (MODE=${MODE} IP=${ip}) ${stamp} ---\n`;
    fs.appendFileSync(RUN_LOG, header);

    for (const r of rows) {
      const { expected, input } = r;
      // 1) Gate
      let gateRes = { filtered: false };
      try {
        gateRes = await gateMessage(input, ip);
      } catch (e) {
        fs.appendFileSync(RUN_LOG, `[gate] error: ${e?.message}\n`);
      }

      // 2) Core (skipAI — vi testar regler/heuristik först)
      let coreRes = {};
      if (gateRes && gateRes.lang) {
        coreRes = { lang: gateRes.lang, via: gateRes.via || "gate", confidence: gateRes.confidence ?? 1.0 };
      } else {
        coreRes = await detectLangCore(input, { skipAI: true, ipCountryCode: null });
      }
      const coreLang = coreRes.lang || "UNKNOWN";
      const coreVia  = coreRes.via || "";
      const coreConf = coreRes.confidence ?? 0;

      // 3) (Valfritt) Backend/AI-fallback — bara om UNKNOWN eller låg conf
      let backendStatus = "";
      let backendLang = "";
      if (MODE === "backend" && (coreLang === "UNKNOWN" || coreConf < 0.7)) {
        const backend = await callBackend(input, ip);
        backendStatus = backend.ok ? String(backend.status) : `ERR:${backend.error}`;
        // Försök läsa språk ur backend-svar (anpassa efter din API-respons)
        backendLang = backend?.data?.lang || backend?.data?.detectedLang || "";
      } else if (MODE === "local" && (coreLang === "UNKNOWN" || coreConf < 0.7)) {
        try {
          const local = await chatPipeline({ message: input, ip });
          backendStatus = "LOCAL";
          backendLang = local?.lang || local?.detectedLang || "";
        } catch (e) {
          backendStatus = `LOCAL_ERR:${e?.message}`;
        }
      }

      const gotLang = backendLang || coreLang;
      const passFail = gotLang === expected ? "PASS" : (gotLang === "UNKNOWN" ? "PARTIAL" : "FAIL");
      if (passFail === "PASS") pass++; else if (passFail === "FAIL") fail++; else partial++;

      // Logga rad
      const viaCombined = backendLang ? `${coreVia}→backend` : coreVia;
      const line = `[${stamp}] "${input}" expected=${expected} gate=${gateRes?.lang || "—"} core=${coreLang}(${coreVia}:${coreConf}) backend=${backendStatus || "—"} final=${gotLang} → ${passFail}\n`;
      fs.appendFileSync(RUN_LOG, line);

      summary.push({
        iter,
        expected,
        input,
        gateLang: gateRes?.lang || "",
        coreLang,
        coreVia,
        coreConf,
        backendStatus,
        backendLang,
        viaCombined,
        passFail
      });
    }
  }

  // Spara summary
  fs.writeFileSync(SUMMARY_JSON, JSON.stringify(summary, null, 2), "utf8");
  const csvHeader = "iter,expected,input,gateLang,coreLang,coreVia,coreConf,backendStatus,backendLang,viaCombined,passFail\n";
  const csvBody = summary.map(toCsvLine).join("\n");
  fs.writeFileSync(SUMMARY_CSV, csvHeader + csvBody + "\n", "utf8");

  // Skriv en slutrad
  const footer = `\nDONE. Totalt rader: ${summary.length}. PASS=${pass} FAIL=${fail} PARTIAL=${partial}\n`;
  fs.appendFileSync(RUN_LOG, footer);

  console.log(footer);
}

main().catch(err => {
  console.error("torture-v5 error:", err);
  process.exit(1);
});
