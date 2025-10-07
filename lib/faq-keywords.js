// /lib/faq-keywords.js
import Fuse from "fuse.js";
import { getLookupCache, getFaqCache } from "./faq-cache.js"; // 🆕 använder cache istället för Sheets

// === Hitta keywords i en fråga ===
export function matchKeywords(lang, input) {
  const lookupByLang = getLookupCache();   // 🆕 hämta lookups från cache
  if (!lookupByLang[lang]) return [];

  const inputLower = input.toLowerCase();
  const words = inputLower.split(/\W+/).filter(Boolean);

  const matches = lookupByLang[lang].filter((kw) => {
    const kwLower = kw.toLowerCase();

    // 1. Enkla ord (ett ord) → måste matcha exakt ett av orden
    if (!kwLower.includes(" ")) {
      return words.includes(kwLower);
    }

    // 2. Flerords-nyckel (ex "home delivery") → matcha hela frasen
    const regex = new RegExp(`\\b${kwLower}\\b`, "i");
    return regex.test(inputLower);
  });

  return [...new Set(matches)];
}

// === Söka FAQ med keywords ===
export function searchFaqWithKeywords(lang, input) {
  const kws = matchKeywords(lang, input);
  if (kws.length === 0) return null;

  const allFaq = getFaqCache()[lang] || [];
  const candidates = allFaq.filter((f) => {
    // acceptera både q/a och question/answer
    const q = f.q || f.question;
    const a = f.a || f.answer;

    if (!q || !a) {
      console.warn("[faq-keywords] ⚠️ Skippade trasig FAQ-rad:", f);
      return false;
    }

    return kws.some(
      (kw) => q.toLowerCase().includes(kw) || a.toLowerCase().includes(kw)
    );
  });

  console.log(
    `[faq-keywords] ${lang} → ${candidates.length} kandidater efter keyword-filter (keywords: ${kws.join(", ")})`
  );

  if (candidates.length === 0) return null;
  if (candidates.length === 1) {
    return { ...candidates[0], score: 1.0, source: "keyword" };
  }

  // Använd Fuse på kandidaterna
  const fuse = new Fuse(candidates, {
    keys: ["q", "a", "question", "answer"],
    threshold: 0.6,       // lite snällare
    includeScore: true,   // så vi kan logga
  });

  const results = fuse.search(input);

  if (results.length === 0) {
    console.log(`[faq-keywords] ⚠️ Fuse hittade inga träffar för ${lang}`);
    return null;
  }

  // Logga topp 3
  results.slice(0, 3).forEach((r) => {
    console.log(
      `   🔍 Kandidat: "${r.item.q || r.item.question}" (score=${r.score.toFixed(2)})`
    );
  });

  // Ta bästa kandidat
  const { item, score } = results[0];

  // Om bästa score är väldigt dåligt → ingen match
  if (score > 0.8) {
    console.log(
      `[faq-keywords] ⚠️ Bästa träffen för ${lang} är för dålig (score=${score.toFixed(2)})`
    );
    return null;
  }

  return { ...item, score, source: "keyword+fuse" };
}
