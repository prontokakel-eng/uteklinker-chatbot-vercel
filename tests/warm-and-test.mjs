// tests/warm-and-test.mjs
// One-stop warm + integrity + sample-search suite.
// Kör med:  node tests/warm-and-test.mjs [--fresh] [--debug]

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initFaqCache, getFaqCache } from "../lib/faq-cache.js";
import { initFaqData, searchFaq } from "../lib/faq-data.js"; // Fuse-index + sök

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FRESH = process.argv.includes("--fresh");
const DEBUG = process.argv.includes("--debug");

// OBS: faq-cache.js skriver normalt till projektrotens faq-cache.json.
// Vi pekar därför ett steg upp från tests/.
const CACHE_FILE = path.resolve(__dirname, "../faq-cache.json");

// Helpers
const short = (s, n = 90) => {
  const t = String(s ?? "");
  return t.length > n ? t.slice(0, n - 1) + "…" : t;
};
const firstQ = (arr) => {
  const r = Array.isArray(arr) ? arr[0] : null;
  return (r?.question ?? r?.q ?? "") || "";
};
const refsEqual = (a, b) => a && b && a === b;
const hasSE = (s) => /[åäöÅÄÖ]/.test(s);
const hasDA = (s) => /[æøÆØ]/.test(s);

// 1) Ev. rensa cache
if (FRESH) {
  try {
    fs.unlinkSync(CACHE_FILE);
    console.log("🧹 Cleared cache:", CACHE_FILE);
  } catch {
    console.log("ℹ️ No existing cache to clear");
  }
} else {
  console.log("ℹ️ Using existing cache if present. Pass --fresh to rebuild.");
}

// 2) Warm cache från Sheets och persistera
await initFaqCache("warm-and-test");

// 3) Bygg Fuse-index (faq-data.init bygger index för SE/EN/DA/DE)
await initFaqData({ caller: "warm-and-test" });

// 4) Integrity: counts + första fråga per språk + referens/tecken-koll
const cacheRaw = getFaqCache(); // Kan vara { SE:[], EN:[], ... } eller { faq:{...}, lookups:{...} }
const faqMap = cacheRaw?.faq && typeof cacheRaw.faq === "object" ? cacheRaw.faq : cacheRaw;

const SE = faqMap?.SE || [];
const EN = faqMap?.EN || [];
const DA = faqMap?.DA || [];
const DE = faqMap?.DE || [];

const counts = { SE: SE.length, EN: EN.length, DA: DA.length, DE: DE.length };
console.log("\n📊 Counts per language:", counts);

const firsts = {
  SE: firstQ(SE),
  EN: firstQ(EN),
  DA: firstQ(DA),
  DE: firstQ(DE),
};

console.log("\n🔎 First question per language:");
for (const [L, q] of Object.entries(firsts)) {
  console.log(` ${L}: "${short(q)}"`);
}

// Ref integrity
const refIssues = [];
if (refsEqual(SE, EN)) refIssues.push("SE and EN share the same array reference");
if (refsEqual(SE, DA)) refIssues.push("SE and DA share the same array reference");
if (refsEqual(SE, DE)) refIssues.push("SE and DE share the same array reference");
if (refsEqual(EN, DA)) refIssues.push("EN and DA share the same array reference");
if (refsEqual(EN, DE)) refIssues.push("EN and DE share the same array reference");
if (refsEqual(DA, DE)) refIssues.push("DA and DE share the same array reference");

if (refIssues.length) {
  console.warn("\n⚠️ Reference issues detected:");
  refIssues.forEach((m) => console.warn("  -", m));
} else {
  console.log("\n✅ No shared array references between languages");
}

// Teckenkontroll (indikativ check för fel språkdata)
if (firsts.EN && (hasSE(firsts.EN) || hasDA(firsts.EN))) {
  console.warn('⚠️ EN first question contains Nordic diacritics → might not be English data.');
} else {
  console.log("✅ EN first question looks non-Nordic");
}

// (Valfritt) Lookups-koll om de ligger i cachen
const lookupsMap = cacheRaw?.lookups;
if (lookupsMap && typeof lookupsMap === "object") {
  const lCounts = {
    SE: Array.isArray(lookupsMap.SE) ? lookupsMap.SE.length : 0,
    EN: Array.isArray(lookupsMap.EN) ? lookupsMap.EN.length : 0,
    DA: Array.isArray(lookupsMap.DA) ? lookupsMap.DA.length : 0,
    DE: Array.isArray(lookupsMap.DE) ? lookupsMap.DE.length : 0,
  };
  console.log("\n🧩 Lookups per language:", lCounts);
  if (DEBUG) {
    // visa några exempel
    for (const L of ["SE", "EN", "DA", "DE"]) {
      const arr = Array.isArray(lookupsMap[L]) ? lookupsMap[L] : [];
      console.log(`  ${L}: examples:`, arr.slice(0, 5).map(String));
    }
  }
} else {
  console.log("\nℹ️ No lookups map present in cache (or not yet normalized).");
}

// 5) Sample-sökningar per språk via Fuse (faq-data.searchFaq)
console.log("\n🧪 Sample searches:");
const samples = [
  { q: "färg på plattor", L: "SE" },
  { q: "color of tiles",   L: "EN" },
  { q: "kørsel med bil",   L: "DA" },
  { q: "Farbe der Platten",L: "DE" },
];

for (const { q, L } of samples) {
  const res = searchFaq(L, q, { limit: 5 }) || [];
  console.log(`\nQuery="${q}" lang=${L} → hits=${res.length}`);
  res.forEach((r) => {
    const title = r?.question || "";
    const score = r?.score != null ? r.score.toFixed(3) : "?";
    console.log(` - ${title} (score: ${score} )`);
  });
}

// Exit code om något är uppenbart fel
let exitCode = 0;
if (!counts.SE || !counts.EN || !counts.DA || !counts.DE) exitCode = 2;
if (refIssues.length) exitCode = Math.max(exitCode, 3);

console.log("\nDone.\n");
process.exit(exitCode);
