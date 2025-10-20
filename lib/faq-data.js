// lib/faq-data.js
import Fuse from "fuse.js";
import { initFaqCache, getFaqCache } from "./faq-cache.js";
import { logMessage } from "./logger.js";
import fs from "fs";
import path from "path";
import os from "os";


// --- Global state to survive Next.js dev reloads ---
const __G = (globalThis.__FAQ_STATE ||= {
  inFlightInit: null,                 // Promise för pågående init (debounce)
  lastVersionToken: null,             // Senast indexerade dataversion (checksum)
  indexBuiltOnce: false,              // Har vi byggt index minst en gång?
  fuseIndex: { SE: null, DA: null, DE: null, EN: null }, // per-språk Fuse
});

// Små hjälpare för att undvika modul-lokala variabler
const getFuseIndex = (lang) => __G.fuseIndex[lang];
const setFuseIndex = (lang, idx) => (__G.fuseIndex[lang] = idx);

const DEFAULT_FUSE_OPTIONS = {
  includeScore: true,
  includeMatches: false,
  threshold: 0.3,
  distance: 100,
  minMatchCharLength: 2,
  ignoreLocation: true,
  useExtendedSearch: false,
  keys: ["question"], // 🔑 sök bara i hela frågetexten
};

// === Normalize cache (FAQ-delen av cachen) ===
function normalizeCache(cache) {
  const langs = ["SE", "DA", "DE", "EN"];
  const normalized = {};
  const faqPart = cache?.faq || cache; // fallback om man skickar direkt {SE:..}

  for (const lang of langs) {
    const arr = Array.isArray(faqPart?.[lang]) ? faqPart[lang] : [];
    normalized[lang] = arr
      .map((item) => {
        if (!item) return { question: "" };

        if (typeof item === "string") {
          return { question: item, answer: "" };
        }
        if (typeof item === "object") {
          return {
            question: String(item.question ?? item.q ?? "").trim(),
            answer: String(item.answer ?? item.a ?? "").trim(),
          };
        }
        return { question: String(item ?? "") };
      })
      .filter((x) => x.question && x.question.trim().length > 0);
  }
  return normalized;
}

// --- Liten deterministisk checksum utan externa imports ---
function checksum(obj) {
  try {
    // Stabil JSON-serialisering: sortera toppnivånycklar
    const keys = Object.keys(obj || {}).sort();
    const s = JSON.stringify(obj, keys);
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash + s.charCodeAt(i)) >>> 0;
    return hash.toString(16);
  } catch {
    return "0";
  }
}

// --- Beräkna versionstoken baserat på normaliserad FAQ-data ---
function makeVersionTokenFromCache(rawCache) {
  // Samma normalisering som indexet bygger på
  const normalized = normalizeCache(rawCache);

  // Kompakt struktur: endast frågetexter per språk i fast ordning
  const langs = ["SE", "DA", "DE", "EN"];
  const compact = {};
  for (const lang of langs) {
    const arr = Array.isArray(normalized[lang]) ? normalized[lang] : [];
    // Ta bara med frågetext; sortera för att stabilisera token även om
    // indata-ordningen varierar mellan körningar (endast för token!)
    compact[lang] = arr.map((x) => x?.question ?? "").slice().sort();
  }
  return checksum(compact);
}

// === Init FAQ data (debounced + memoized med globalt state) ===
export async function initFaqData(caller = "unknown") {
  logMessage("faq-data.log", `🔄 Init FAQ data (caller: ${caller})`);
  const pid = typeof process !== "undefined" ? process.pid : "n/a";
  logMessage("faq-data.log", `🔄 Init FAQ data (pid=${pid}, caller: ${caller})`);

  // Debounce: om en init redan pågår, återanvänd den
  if (__G.inFlightInit) {
    logMessage("faq-data.log", `[initFaqData] SKIP (debounced/in-flight) caller=${caller}`);
    return __G.inFlightInit;
  }

  // Sätt in-flight promise som wrappar init
  __G.inFlightInit = (async () => {
    // Hämta/validera cache
    const cache = await initFaqCache(caller);

    try {
      // Memo: räkna versionstoken och skippa om index redan motsvarar denna data
      const token = makeVersionTokenFromCache(cache);
      if (__G.indexBuiltOnce && __G.lastVersionToken === token) {
        logMessage("faq-data.log", `[initFaqData] SKIP (memoized index) caller=${caller} version=${token}`);
        return; // ⟵ hoppa över om datan är oförändrad
      }
      // 1) Persisted sentinel: skip även över processgränser
     const diskToken = readTokenFromDisk();
     if (diskToken && diskToken === token) {
     // Synka in-memory state så searchFaq funkar utan build
     __G.lastVersionToken = token;
     __G.indexBuiltOnce = true;
     logMessage("faq-data.log", `[initFaqData] SKIP (persisted token) caller=${caller} version=${token}`);
     return;
}

      // Bygg index
      buildFaqIndex(cache, DEFAULT_FUSE_OPTIONS, caller);

      // Uppdatera memo-tillstånd
      __G.lastVersionToken = token;
      __G.indexBuiltOnce = true;
      logMessage("faq-data.log", `[initFaqData] DONE (index updated) version=${token}`);
      writeTokenToDisk(token);
    } catch (e) {
      // Vid fel, bygg i alla fall index för säkerhet
      logMessage(
        "faq-data.log",
        `⚠️ initFaqData memo failed (${e?.message || e}), building index anyway`
      );
      buildFaqIndex(cache, DEFAULT_FUSE_OPTIONS, caller);
      __G.indexBuiltOnce = true;
      __G.lastVersionToken = null; // okänd version denna gång
    }
  })();

  try {
    return await __G.inFlightInit;
  } finally {
    // Rensa in-flight
    __G.inFlightInit = null;
  }
}

// === Build Fuse index ===
export function buildFaqIndex(
  cache = null,
  fuseOptions = DEFAULT_FUSE_OPTIONS,
  caller = "unknown"
) {
  const raw = cache || getFaqCache();
  const data = normalizeCache(raw);
  const langs = Object.keys(__G.fuseIndex);

  for (const lang of langs) {
    const idx = data[lang].length ? new Fuse(data[lang], fuseOptions) : null;
    setFuseIndex(lang, idx);
  }

  const sizes = {};
  for (const lang of langs) sizes[lang] = data[lang].length;
  logMessage(
    "faq-data.log",
    `✅ Fuse-index byggt för FAQ (caller: ${caller}): ${JSON.stringify(sizes)}`
  );
}

// --- Persisted version sentinel (överlever processer) ---
const LOG_DIR = path.join(process.cwd(), "logs");
const TOKEN_FILE = path.join(LOG_DIR, "faq-index.version");

function ensureLogDir() {
  try { if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}
}
function readTokenFromDisk() {
  try { return fs.readFileSync(TOKEN_FILE, "utf8").trim(); } catch { return null; }
}
function writeTokenToDisk(token) {
  try { ensureLogDir(); fs.writeFileSync(TOKEN_FILE, String(token), "utf8"); } catch {}
}


// === Fuzzy Search ===
export function searchFaq(lang, input, { limit = 3 } = {}) {
  if (!input || typeof input !== "string") return null;
  const fuse = getFuseIndex(lang);
  if (!fuse) {
    logMessage("faq-data.log", `⚠️ searchFaq: inget Fuse-index för lang=${lang}`);
    return null;
  }

  const results = fuse.search(input);
  if (!results.length) {
    logMessage(
      "faq-data.log",
      `ℹ️ searchFaq: inga träffar för lang=${lang}, input="${input}"`
    );
    return null;
  }

  logMessage(
    "faq-data.log",
    `[DEBUG] searchFaq lang=${lang}, input="${input}" → ${results.length} träffar`
  );
  results.slice(0, 5).forEach((r, i) => {
    logMessage(
      "faq-data.log",
      `   #${i + 1}: "${r.item.question}" (score=${r.score?.toFixed(3)})`
    );
  });

  // Dedup per question, välj bästa (lägst score)
  const bestByQuestion = new Map();
  for (const r of results) {
    const q = r.item.question || "";
    const prev = bestByQuestion.get(q);
    if (!prev || (r.score ?? 1) < (prev.score ?? 1)) {
      bestByQuestion.set(q, {
        question: q,
        answer: r.item.answer,
        score: r.score,
      });
    }
  }

  const uniques = Array.from(bestByQuestion.values())
    .sort((a, b) => (a.score ?? 1) - (b.score ?? 1))
    .slice(0, limit);

  if (uniques.length > 0) {
    logMessage(
      "faq-data.log",
      `✅ Bästa träff: "${uniques[0].question}" → "${(uniques[0].answer || "").slice(0, 80)}..."`
    );
  }

  return uniques;
}
