// lib/faq-search.js (v2.4)
// Robust Fuse.js search with normalization, Nordic fallback, auto warm, and dynamic key discovery.
// Includes safe path handling in getFn(), FUSE_DEBUG flags (1 = key list, 2 = sample hits),
// and enrichment with per-language lookups (_kw) + slightly higher recall for DA/DE.

import Fuse from "fuse.js";
import { getFaqCacheView, canonicalizeLangKey, ensureFaqWarm } from "./faq-cache-view.js";
import { getFaqCache } from "./faq-cache.js"; // för lookups-enrichment

const norm = (s)=> String(s ?? "")
  .normalize("NFD")
  .replace(/\p{Diacritic}/gu, "")
  .toLocaleLowerCase();

// Discover string keys to index from sample rows
function discoverKeys(rows, cap = 10) {
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const sample = rows.slice(0, 5);
  const keys = new Set();
  for (const item of sample) {
    if (item && typeof item === "object") {
      for (const [k, v] of Object.entries(item)) {
        if (typeof v === "string") {
          if (v.trim().length > 0) keys.add(k);
        } else if (Array.isArray(v) && v.length && typeof v[0] === "string") {
          keys.add(k);
        }
      }
    }
  }
  // Prefer likely text fields
  const preferred = [
    "question","answer","keywords",
    "question_se","answer_se","answer_se_injected",
    "title","body","text","content","desc","description"
  ];
  const ordered = [
    ...preferred.filter(k => keys.has(k)),
    ...[...keys].filter(k => !preferred.includes(k))
  ];
  return ordered.slice(0, cap);
}

const cacheFuse = new Map(); // L -> { fuse, keys, __rows }

function getFuse(lang, rows){
  const L = canonicalizeLangKey(lang);
  const memo = cacheFuse.get(L);
  if (memo?.__rows === rows) return memo;

  const keys = discoverKeys(rows);

  // Enrich: hämta språkets lookups och gör en enkel bag-of-words (_kw)
  let kwBlob = "";
  try {
    const cache = getFaqCache(); // { faq, lookups } eller { ... }
    const lookupsArr =
      (cache?.lookups && Array.isArray(cache.lookups[L]) && cache.lookups[L]) ||
      (cache?.Lookups && Array.isArray(cache.Lookups[L]) && cache.Lookups[L]) ||
      [];
    if (lookupsArr.length) kwBlob = lookupsArr.join(" ");
  } catch {}

  // Se till att _kw finns bland keys (utan att röra discoverKeys’ övriga urval)
  if (!keys.includes("_kw")) keys.push("_kw");

  if (process.env.FUSE_DEBUG === "1" || process.env.FUSE_DEBUG === "2") {
    console.log(`[Fuse Debug] Building index for ${L}, keys=${keys.join(", ")}`);
  }

  const options = {
    includeScore: true,
    // lite högre recall för DA/DE
    threshold: (L === "DA" || L === "DE") ? 0.45 : 0.34,
    ignoreLocation: true,
    minMatchCharLength: 2,
    keys: keys.length ? keys : undefined,
  };

  const fuse = new Fuse(
    // injicera _kw per item (samma blob för språket – enkel baseline)
    rows.map(x => ({ __t: { ...x, _kw: kwBlob } })), // wrapper for normalization
    {
      ...options,
      keys: Array.isArray(keys) && keys.length
        ? keys.map(k => `__t.${k}`)
        : undefined,

      // Safe Fuse path handler — prevents path.split crash, traverses inside __t
      getFn: (obj, path) => {
        const src = obj?.__t;
        if (!path) return norm(JSON.stringify(src ?? ""));

        const keyPath = Array.isArray(path) ? path.join(".") : String(path);
        const pathParts = keyPath.startsWith("__t.")
          ? keyPath.split(".").slice(1)
          : keyPath.split(".");

        const val = pathParts.reduce((o, k) => o?.[k], src);
        if (Array.isArray(val)) return norm(val.join(" "));
        return norm(val);
      }
    }
  );

  // Optional sample hits when FUSE_DEBUG=2
  if (process.env.FUSE_DEBUG === "2") {
    try {
      const sampleQuery = keys[0] || "test";
      const sampleHits = fuse.search(sampleQuery, { limit: 3 });
      if (sampleHits.length) {
        console.log(`[Fuse Debug] Sample hits for ${L}:`);
        for (const r of sampleHits) {
          const q = r.item.__t.question || r.item.__t.title || "(no question)";
          console.log(` - ${q} (score: ${r.score.toFixed(3)})`);
        }
      } else {
        console.log(`[Fuse Debug] No sample hits for ${L}`);
      }
    } catch (e) {
      console.warn(`[Fuse Debug] Failed to run sample search for ${L}: ${e.message}`);
    }
  }

  const pack = { fuse, keys, __rows: rows };
  cacheFuse.set(L, pack);
  return pack;
}

/**
 * Search cached FAQ using Fuse.js with strong normalization and Nordic fallback.
 * Auto-warms the cache if arrays are empty.
 */
export async function searchFaq(query, { lang="SE", limit=8 } = {}) {
  const L = canonicalizeLangKey(lang);
  let rows = await getFaqCacheView(L);

  if ((!rows || !rows.length) && query) {
    await ensureFaqWarm({ force: true });
    rows = await getFaqCacheView(L);
  }
  if (!query || !rows?.length) return [];

  const { fuse } = getFuse(L, rows);
  const out = fuse.search(String(query), { limit }).map(r => ({ item: r.item.__t, score: r.score }));
  if (out.length) return out;

  // Nordic fallback
  const hasSE = /[åäö]/i.test(query);
  const hasDA = /[æø]/i.test(query);
  const tried = new Set([L]);

  const tryLang = async (langTry) => {
    const LT = canonicalizeLangKey(langTry);
    if (tried.has(LT)) return [];
    tried.add(LT);
    let altRows = await getFaqCacheView(LT);
    if (!altRows?.length) {
      await ensureFaqWarm({ force: true });
      altRows = await getFaqCacheView(LT);
    }
    if (!altRows?.length) return [];
    const { fuse: f2 } = getFuse(LT, altRows);
    return f2.search(String(query), { limit }).map(r => ({ item: r.item.__t, score: r.score }));
  };

  if (hasSE) {
    const first = await tryLang("SE"); if (first.length) return first;
    const second = await tryLang("DA"); if (second.length) return second;
  } else if (hasDA) {
    const first = await tryLang("DA"); if (first.length) return first;
    const second = await tryLang("SE"); if (second.length) return second;
  }

  return [];
}
