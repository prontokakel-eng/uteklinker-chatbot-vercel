// 🧩 /lib/detect-lang-rules.js
// Regelbaserad språkdetektion – ren & körklar
// - DA prioritet före SE (sedan DE, EN)
// - Strong markers (DA: æ/ø + hv-ord, DE: ß/ü + nyckelord) → confidence=1.0
// - SE unika ord (inte diakriter) → normal vikt
// - EN utökade ankare
// - Mixed-language correction: "Hej" + (how|are|you) → EN
// - Loggar starka markörer & mix-korrigering till detect-lang.log

import { logMessage } from "./logger.js";

export const regexAnchors = {
  SE: [
    "hej", // fallback for standalone tests (Gate hanterar hälsningar)
    "hallå", "tack", "varför", "hur", "vilken", "vad", "snälla",
    "kunde", "skulle", "gärna", "klinker", "platta", "golv", "vägg",
    "dyr", "billig", "badrum", "utomhus", "inomhus", "färg", "storlek"
  ],
  DA: [
    "hvordan", "hvilken", "hvad", "hvorfor", "hvem",
    "ikke", "bedst", "fliser", "tak", "klinker", "udendørs", "indendørs",
    "billig", "farve", "størrelse", "gulv", "væg", "æ", "ø"
  ],
  DE: [
    "welche", "warum", "wie", "danke", "fliesen", "frost", "badezimmer",
    "teuer", "preis", "grösse", "größe", "wand", "boden", "außen", "innen",
    "ß", "ü"
  ],
  EN: [
    "why", "how", "what", "which", "are", "tiles", "expensive", "cheap",
    "bathroom", "indoor", "outdoor", "floor", "wall", "color", "size",
    "thanks", "hello", "hi", "good", "morning", "evening", "best",
    "ok", "okay", "the", "you", "ing"
  ]
};

// Unika / starka markörer per språk (ger confidence=1.0)
export const exclusiveRegex = {
  SE: [/\bvarför\b/, /\btack\b/],
  DA: [/\bhvordan\b/, /\bhvilken\b/, /\bhvad\b/, /\bhvorfor\b/, /\bhvem\b/, /æ/, /ø/],
  DE: [/\bwelche\b/, /ß/, /ü/, /\bnicht\b/, /\bund\b/],
  EN: [/\bwhy\b/, /\bhow\b/, /\bthe\b/, /\bing\b/, /\byou\b/]
};

export const confidenceRules = {
  strong: 1.0,
  medium: 0.8,
  weak: 0.5
};

export function detectLangRulesOnly(text = "") {
  if (!text || typeof text !== "string") {
    return { lang: "UNKNOWN", via: "regex", confidence: 0, NeedsAI: true, matches: [] };
  }

  const lower = text.toLowerCase();

  // 1) Strong markers (exclusiveRegex)
  for (const [lang, patterns] of Object.entries(exclusiveRegex)) {
    if (patterns.some((rx) => rx.test(lower))) {
      logMessage("detect-lang.log", `🔍 Strong marker detected: ${lang}`);
      return { lang, via: "regex-exclusive", confidence: confidenceRules.strong, NeedsAI: false, matches: [] };
    }
  }

  // 2) Anchors – prioritet: DA → SE → DE → EN
  const langPriority = ["DA", "SE", "DE", "EN"];
  for (const lang of langPriority) {
    const anchors = regexAnchors[lang];
    const found = anchors.filter((a) => lower.includes(a));
    if (found.length) {
      const conf = found.length > 2 ? confidenceRules.strong : confidenceRules.medium;
      const result = { lang, via: "short-lexicon", confidence: conf, NeedsAI: false, matches: found };

      // Mixed-language correction: SE "hej" + engelska ord → EN
      if (result.lang === "SE" && /\bhow\b|\bare\b|\byou\b/.test(lower)) {
        logMessage("detect-lang.log", "⚖️ Mixed-language detected (SE + EN markers)");
        return { lang: "EN", via: "mixed-heuristic", confidence: 0.9, NeedsAI: false, matches: ["hej","how","are","you"] };
        // (obs: detta påverkar bara blandade fraser; ren SE med 'hej' påverkas ej)
      }

      return result;
    }
  }

  // 3) Ingen match → UNKNOWN (AI-fallback kan ta över)
  return { lang: "UNKNOWN", via: "regex", confidence: 0, NeedsAI: true, matches: [] };
}

// Endast för manuella sanity-tester (ej runtime-kritisk)
export const testSamples = {
  SE: [
    "Hej, hur mår du?", "Varför är klinkerdäck dyra?", "Tack för hjälpen!",
    "Vilken färg passar bäst till badrum?"
  ],
  DA: [
    "Hvordan har du det i dag?", "Hvilken klinker passer bedst?", "Tak for hjælpen!"
  ],
  DE: [
    "Welche Fliesen sind am besten?", "Muss ich die Fliesen gegen Frost schützen?",
    "Danke schön!"
  ],
  EN: [
    "How are you doing today?", "Why are tiles so expensive?", "Thanks a lot!", "Ok, let's go!"
  ]
};
