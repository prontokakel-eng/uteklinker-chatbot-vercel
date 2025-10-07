// 🧩 /lib/detect-lang-rules.js
// Regelbaserad språkdetektion med starka markörer (DA/DE) och loggning – 2025-10-06

import { logMessage } from "./logger.js";

export const regexAnchors = {
  SE: [
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

export const exclusiveRegex = {
  SE: [/å/, /ä/, /ö/, /varför/, /tack/],
  DA: [/hvordan/, /hvilken/, /hvad/, /hvorfor/, /hvem/, /æ/, /ø/],
  DE: [/welche/, /ß/, /ü/, /nicht/, /und/],
  EN: [/why/, /how/, /the/, /ing/, /you/]
};

export const confidenceRules = {
  strong: 1.0,
  medium: 0.8,
  weak: 0.5
};

export function detectLangRulesOnly(text = "") {
  if (!text || typeof text !== "string") return { lang: "UNKNOWN", via: "regex", confidence: 0 };

  const lower = text.toLowerCase();

  // 1️⃣ Check for strong markers (DA/DE special chars)
  for (const [lang, patterns] of Object.entries(exclusiveRegex)) {
    if (patterns.some((rx) => rx.test(lower))) {
      logMessage("detect-lang.log", `🔍 Strong marker detected: ${lang}`);
      return { lang, via: "regex-exclusive", confidence: confidenceRules.strong, NeedsAI: false, matches: [] };
    }
  }

  // 2️⃣ Anchors (DA prioritet först)
  const langPriority = ["DA", "SE", "DE", "EN"];
  for (const lang of langPriority) {
    const anchors = regexAnchors[lang];
    const found = anchors.filter((a) => lower.includes(a));
    if (found.length) {
      const conf = found.length > 2 ? confidenceRules.strong : confidenceRules.medium;
      return { lang, via: "short-lexicon", confidence: conf, NeedsAI: false, matches: found };
    }
  }

  return { lang: "UNKNOWN", via: "regex", confidence: 0, NeedsAI: true, matches: [] };
}

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
