// lib/faq-cache-view.js
// Bridge för runtime: plockar språkseparerade FAQ från cache utan fallback.
// Exporterar samma API-namn som faq-search.js och testerna använder.

import { initFaqCache, getFaqCache } from "./faq-cache.js";

const LANGS = ["SE", "EN", "DA", "DE"];

export function canonicalizeLangKey(lang) {
  const s = String(lang || "SE").toLowerCase();
  if (s.startsWith("en")) return "EN";
  if (s.startsWith("da") || s === "dk") return "DA";
  if (s.startsWith("de") || s === "ger") return "DE";
  if (s.startsWith("sv") || s === "se") return "SE";
  return "SE";
}

// Intern hjälpare: räkna antal per språk från cacheformatet {SE:[], EN:[], ...}
function countsFromCache(cache) {
  return {
    SE: Array.isArray(cache?.SE) ? cache.SE.length : 0,
    EN: Array.isArray(cache?.EN) ? cache.EN.length : 0,
    DA: Array.isArray(cache?.DA) ? cache.DA.length : 0,
    DE: Array.isArray(cache?.DE) ? cache.DE.length : 0,
  };
}

// ⚠️ Ingen tyst fallback till SE – returnerar exakt begärt språk
export async function getFaqCacheView(lang = "SE") {
  const L = canonicalizeLangKey(lang);
  // Hämta senast uppvärmda cacheobjektet { SE:[], EN:[], DA:[], DE:[] }
  const cache = getFaqCache(); // från faq-cache.js:contentReference[oaicite:0]{index=0}
  const arr = Array.isArray(cache?.[L]) ? cache[L] : [];
  // Normalisera ytan utan att dela referenser med cachen
  return arr.map(r => ({
    question: String(r?.question ?? r?.q ?? ""),
    answer:   String(r?.answer   ?? r?.a ?? ""),
  }));
}

// Används av testerna: returnerar counts per språk
export async function getFaqCounts() {
  const cache = getFaqCache(); // {SE:[], EN:[], ...}:contentReference[oaicite:1]{index=1}
  return countsFromCache(cache);
}

// Ser till att cachen är uppvärmd. force=true → bygg från Sheets igen.
export async function ensureFaqWarm({ force = false, caller = "faq-cache-view" } = {}) {
  const before = await getFaqCounts();
  const totalBefore = Object.values(before).reduce((a, b) => a + b, 0);

  if (force || totalBefore === 0) {
    await initFaqCache(caller); // laddar från Sheets och persisterar cache:contentReference[oaicite:2]{index=2}
  }

  const after = await getFaqCounts();
  if (process.env.FAQ_DEBUG === "1") {
    // Logga en snabb sanity för varje språk
    for (const L of LANGS) {
      const list = (getFaqCache()?.[L]) || [];
      const head = list[0]?.question || list[0]?.q || "";
      console.log(`[faq-cache-view] ${L}: ${list.length} rader, first="${String(head).slice(0,60)}"`);
    }
  }
  return after;
}

export default { getFaqCacheView, getFaqCounts, ensureFaqWarm, canonicalizeLangKey };
