// lib/faq-data.js
import Fuse from "fuse.js";
import { initFaqCache, getFaqCache } from "./faq-cache.js";
import { logMessage } from "./logger.js";

let fuseIndex = { SE: null, DA: null, DE: null, EN: null };

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

// === Init FAQ data ===
export async function initFaqData(caller = "unknown") {
  logMessage("faq-data.log", `🔄 Init FAQ data (caller: ${caller})`);
  const cache = await initFaqCache(caller);
  buildFaqIndex(cache, DEFAULT_FUSE_OPTIONS, caller);
}

// === Build Fuse index ===
export function buildFaqIndex(
  cache = null,
  fuseOptions = DEFAULT_FUSE_OPTIONS,
  caller = "unknown"
) {
  const raw = cache || getFaqCache();
  const data = normalizeCache(raw);
  const langs = Object.keys(fuseIndex);

  for (const lang of langs) {
    fuseIndex[lang] = data[lang].length
      ? new Fuse(data[lang], fuseOptions)
      : null;
  }

  const sizes = {};
  for (const lang of langs) sizes[lang] = data[lang].length;
  logMessage(
    "faq-data.log",
    `✅ Fuse-index byggt för FAQ (caller: ${caller}): ${JSON.stringify(sizes)}`
  );
}

// === Fuzzy Search ===
export function searchFaq(lang, input, { limit = 3 } = {}) {
  if (!input || typeof input !== "string") return null;
  const fuse = fuseIndex[lang];
  if (!fuse) {
    logMessage(
      "faq-data.log",
      `⚠️ searchFaq: inget Fuse-index för lang=${lang}`
    );
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

  // Dedup
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
