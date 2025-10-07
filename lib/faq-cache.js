// lib/faq-cache.js
import fs from "fs";
import path from "path";
import { loadAllFaqData, loadAllLookups } from "./faq-sheets.js"; 
import { logMessage } from "./logger.js";   // ✅ central logg

const CACHE_FILE = path.join(process.cwd(), "faq-cache.json");

// 👉 två separata caches i minnet
let faqCache = { SE: [], DA: [], DE: [], EN: [] };
let lookupCache = { SE: [], DA: [], DE: [], EN: [] };

/**
 * Hämta FAQ-cache (i minnet)
 */
export function getFaqCache() {
  return faqCache;
}

/**
 * Hämta Lookup-cache (i minnet)
 */
export function getLookupCache() {
  return lookupCache;
}

/**
 * Initiera FAQ + Lookup-cache (hämtar från Sheets och sparar till fil)
 */
export async function initFaqCache(caller = "unknown") {
  try {
    const rawFaq = await loadAllFaqData();
    const rawLookups = await loadAllLookups();

    faqCache = normalizeFaq(rawFaq);
    lookupCache = normalizeLookups(rawLookups);

    const combined = { faq: faqCache, lookups: lookupCache };
    fs.writeFileSync(CACHE_FILE, JSON.stringify(combined, null, 2), "utf8");

    logMessage(
      "faq-cache.log",
      `✅ FAQ+Lookups cache laddad & sparad (caller: ${caller}): FAQ=${JSON.stringify(summary(faqCache))}, Lookups=${JSON.stringify(summaryLookups(lookupCache))}`
    );
    return { faq: faqCache, lookups: lookupCache };
  } catch (err) {
    logMessage("faq-cache.log", `⚠️ Kunde inte ladda FAQ/Lookups från Sheets (caller: ${caller}): ${err.message}`);
    return { faq: faqCache, lookups: lookupCache };
  }
}

/**
 * Försök ladda cache från fil
 */
export function loadFaqCache(caller = "unknown") {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const raw = fs.readFileSync(CACHE_FILE, "utf8");
      const parsed = JSON.parse(raw);

      faqCache = normalizeFaq(parsed.faq || parsed);
      lookupCache = normalizeLookups(parsed.lookups || {});

      logMessage(
        "faq-cache.log",
        `✅ FAQ+Lookups cache laddad från fil (caller: ${caller}): FAQ=${JSON.stringify(summary(faqCache))}, Lookups=${JSON.stringify(summaryLookups(lookupCache))}`
      );
    } catch (err) {
      logMessage("faq-cache.log", `⚠️ Kunde inte läsa cachefil (caller: ${caller}): ${err.message}`);
    }
  } else {
    logMessage("faq-cache.log", `🚀 Ingen cache hittades (caller: ${caller}), kör initFaqCache istället.`);
  }
  return { faq: faqCache, lookups: lookupCache };
}

/**
 * Normalisera FAQ-data: mappar om {q,a} → {question,answer}
 */
function normalizeFaq(raw) {
  const out = { SE: [], DA: [], DE: [], EN: [] };
  for (const lang of Object.keys(out)) {
    out[lang] = (raw[lang] || []).map((row) => ({
      question: row.question ?? row.q ?? "",
      answer: row.answer ?? row.a ?? "",
    }));
  }
  return out;
}

/**
 * Normalisera Lookups (listor med keywords)
 */
function normalizeLookups(raw) {
  const out = { SE: [], DA: [], DE: [], EN: [] };
  for (const lang of Object.keys(out)) {
    out[lang] = (raw[lang] || [])
      .map((kw) => (typeof kw === "string" ? kw.toLowerCase() : ""))
      .filter(Boolean);
  }
  return out;
}

function summary(cache) {
  return {
    SE: cache.SE?.length || 0,
    DA: cache.DA?.length || 0,
    DE: cache.DE?.length || 0,
    EN: cache.EN?.length || 0,
  };
}

function summaryLookups(cache) {
  return summary(cache); // samma format
}
