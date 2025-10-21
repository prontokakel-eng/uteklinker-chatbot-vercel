// lib/faq-cache.js — corrected to original API + file format, with idempotent save
import fs from "fs";
import path from "path";
import { loadAllFaqData, loadAllLookups } from "./faq-sheets.js";
import { logMessage } from "./logger.js";

const CACHE_FILE = path.join(process.cwd(), "faq-cache.json");
const LOG = (m) => logMessage("faq-cache.log", m);

// In-memory caches (same shape)
let faqCache = { SE: [], DA: [], DE: [], EN: [] };
let lookupCache = { SE: [], DA: [], DE: [], EN: [] };

// [CHANGE] ──────────────────────────────────────────────────────────────
// Håll senaste skrivna JSON i minnet för snabb jämförelse (write-guard)
let __lastWrittenJson = null;

// Stabil checksum utan extra imports (samma idé som i faq-data)
function __checksum(obj) {
  try {
    const s = JSON.stringify(obj, Object.keys(obj || {}).sort());
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash + s.charCodeAt(i)) >>> 0;
    return hash.toString(16);
  } catch {
    return "0";
  }
}
// [CHANGE] ──────────────────────────────────────────────────────────────

// --- Utilities --------------------------------------------------------------
const langs = ["SE", "DA", "DE", "EN"];
const nonEmpty = (v) => (Array.isArray(v) ? v.length > 0 : !!(v && Object.keys(v).length));
const biggerOrEqual = (oldArr = [], newArr = []) => newArr.length >= (oldArr?.length || 0);

function summary(cache) {
  return {
    SE: cache.SE?.length || 0,
    DA: cache.DA?.length || 0,
    DE: cache.DE?.length || 0,
    EN: cache.EN?.length || 0,
  };
}

// Keep normalize functions identical in behavior to the originals
function normalizeFaq(raw) {
  const out = { SE: [], DA: [], DE: [], EN: [] };
  for (const lang of Object.keys(out)) {
    const src = raw?.[lang] || [];
    out[lang] = Array.isArray(src)
      ? src.map((row) => ({
          question: row?.question ?? row?.q ?? "",
          answer: row?.answer ?? row?.a ?? "",
        }))
      : [];
  }
  return out;
}

function normalizeLookups(raw) {
  const out = { SE: [], DA: [], DE: [], EN: [] };
  for (const lang of Object.keys(out)) {
    const src = raw?.[lang] || [];
    if (!Array.isArray(src)) { out[lang] = []; continue; }
    out[lang] = src
      .map((kw) => {
        if (typeof kw === "string") return kw;                          // sträng direkt
        if (kw && typeof kw === "object" && typeof kw.keyword === "string") {
          return kw.keyword;                                            // Sheets: { keyword }
        }
        return "";
      })
      .filter(Boolean)
      .map((s) => s.toLowerCase());
  }
  return out;
}

// Non-destructive merge: per language, always prefer incoming if non-empty
function mergeFaq(current, incoming) {
  const merged = { ...current };
  for (const L of langs) {
    const cand = incoming?.[L] || [];
    if (cand.length) {
      // 🧠 Deep copy to prevent reference sharing between languages
      merged[L] = JSON.parse(JSON.stringify(cand));
      // [CHANGE] konsekvent log till fil
      LOG(`✅ merged FAQ for ${L}: ${cand.length} rows`);
    }
  }
  return merged;
}

function mergeLookups(current, incoming) {
  const merged = { ...current };
  for (const L of langs) {
    const cand = incoming?.[L] || [];
    if (cand.length) {
      // 🧠 Deep copy here as well, to avoid shared references
      merged[L] = JSON.parse(JSON.stringify(cand));
      // [CHANGE] konsekvent log till fil
      LOG(`✅ merged LOOKUP for ${L}: ${cand.length} entries`);
    }
  }
  return merged;
}

function readFromDiskOnce() {
  if (!fs.existsSync(CACHE_FILE)) return false;
  try {
    const fileText = fs.readFileSync(CACHE_FILE, "utf8");
    const raw = JSON.parse(fileText);
    // File format must remain { faq: ..., lookups: ... }
    faqCache = normalizeFaq(raw?.faq || raw);
    lookupCache = normalizeLookups(raw?.lookups || {});
    LOG(`📖 Läste disk-cache: FAQ=${JSON.stringify(summary(faqCache))}, Lookups=${JSON.stringify(summary(lookupCache))}`);
    // [CHANGE] sätt baseline så första persist kan skippas om identiskt
    __lastWrittenJson = fileText;
    return true;
  } catch (err) {
    LOG(`⚠️ Misslyckades läsa disk-cache: ${err.message}`);
    return false;
  }
}

// [CHANGE] returnera true om fil faktiskt skrevs, annars false
function persistToDisk(combined, reason = "unknown") {
  try {
    const json = JSON.stringify(combined, null, 2);
    if (__lastWrittenJson === json) {
      LOG(`💤 cache unchanged → skip write (reason=${reason})`);
      return false;
    }
    fs.writeFileSync(CACHE_FILE, json, "utf8");
    __lastWrittenJson = json;
    const hash = __checksum(combined);
    LOG(`✅ cache saved (reason=${reason}) hash=${hash}`);
    return true;
  } catch (err) {
    LOG(`⚠️ Misslyckades skriva disk-cache: ${err.message}`);
    return false;
  }
}

// --- Public API (unchanged names) ------------------------------------------
export function getFaqCache() { return faqCache; }
export function getLookupCache() { return lookupCache; }

export async function initFaqCache(caller = "unknown") {
  try {
    // Load existing cache first, so we can merge non-destructively
    readFromDiskOnce();

    const rawFaq = await loadAllFaqData();
    const rawLookups = await loadAllLookups();

    const nextFaq = normalizeFaq(rawFaq);
    const nextLookups = normalizeLookups(rawLookups);

    // Idempotent merge: better (non-empty & >=) wins per language
    faqCache = mergeFaq(faqCache, nextFaq);
    lookupCache = mergeLookups(lookupCache, nextLookups);

    // [CHANGE] skriv bara om fil när något faktiskt ändrats
    const combined = { faq: faqCache, lookups: lookupCache }; // preserve original lowercase keys
    const wrote = persistToDisk(combined, "merge");

    // [CHANGE] logga succésraden endast när vi verkligen skrev
    if (wrote) {
      LOG(`✅ FAQ+Lookups cache laddad & sparad (caller: ${caller}): FAQ=${JSON.stringify(summary(faqCache))}, Lookups=${JSON.stringify(summary(lookupCache))}`);
    } else {
      LOG(`ℹ️ FAQ+Lookups cache oförändrad (caller: ${caller}): FAQ=${JSON.stringify(summary(faqCache))}, Lookups=${JSON.stringify(summary(lookupCache))}`);
    }

    return { faq: faqCache, lookups: lookupCache };
  } catch (err) {
    LOG(`⚠️ Kunde inte ladda FAQ/Lookups från Sheets (caller: ${caller}): ${err.message}`);
    return { faq: faqCache, lookups: lookupCache };
  }
}

export function loadFaqCache(caller = "unknown") {
  readFromDiskOnce();
  LOG(`✅ FAQ+Lookups cache laddad från fil (caller: ${caller}): FAQ=${JSON.stringify(summary(faqCache))}, Lookups=${JSON.stringify(summary(lookupCache))}`);
  return { faq: faqCache, lookups: lookupCache };
}
