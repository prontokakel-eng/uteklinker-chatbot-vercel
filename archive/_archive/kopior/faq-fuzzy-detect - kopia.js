import { searchFaq } from "../lib/faq-data.js";


export function detectLangFaqFuzzy(input) {
  const match = searchFaq(input, { threshold: 0.9 }); // >=90% fuzzy
  if (match) {
    return {
      lang: match.lang,
      via: "faq-fuzzy",
      confidence: 1.0,
      NeedsAI: false,
      matches: [match],
    };
  }
  return null;
}
