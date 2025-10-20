// lib/faq-fuzzy-detect.js
import { searchFaq } from "./faq-data.js";

/**
 * Försök hitta språk via FAQ fuzzy match
 */
export function detectLangFaqFuzzy(input) {
  const langs = ["SE", "DA", "DE", "EN"];
  const matches = [];

  for (const lang of langs) {
    const res = searchFaq(lang, input);
    if (res) {
      matches.push({ lang, ...res });
    }
  }

  if (matches.length === 0) return null;

  // välj bästa match
  const best = matches.reduce((a, b) => (a.score < b.score ? a : b));
  return {
    lang: best.lang,
    via: "faq-fuzzy",
    matches,
  };
}
