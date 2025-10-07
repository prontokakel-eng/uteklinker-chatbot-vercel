// 🧩 /lib/detect-lang-rules.js
// Regelbaserad språkdetektion – städad & robust (2025-10-06)
// - DA prioriteras före SE i anchor-sökning
// - Strong markers (DA: æ/ø + hv-ord, DE: ß/ü + nyckelord) ger confidence=1.0
// - SE har INTE starka diakriter som exclusive markers (endast ord som är unika: 'varför','tack')
// - EN utökat med 'ok','okay','the','you','ing'
// - Mixed-language correction: 'Hej' + engelska ord växlar till EN (via=mixed-heuristic)
// - Loggning till detect-lang.log för starka markörer och mix-korrigering

import { logMessage } from "./logger.js";

export const regexAnchors = {
  SE: [
    "hej", // fallback for standalone tests (Gate handles greetings)
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

// 🧩 Exclusive regex per språk (unika markörer som ger confidence=1.0)
export const exclusiveRegex = {
  SE: [/varför/, /tack/],               // ord unika för SE i denna domän
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
  if (!text || typeof text !== "string") {
    return { lang: "UNKNOWN", via: "regex", confidence: 0, NeedsAI: true, matches: [] };
  }

  const lower = text.toLowerCase();

  // 1️⃣ Strong markers (exclusiveRegex): DA/DE unika tecken/ord, SE/EN specifika ord
  for (const [lang, patterns] of Object.entries(exclusiveRegex)) {
    if (patterns.some((rx) => rx.test(lower))) {
      logMessage("detect-lang.log", `🔍 Strong marker detected: ${lang}`);
      return { lang, via: "regex-exclusive", confidence: confidenceRules.strong, NeedsAI: false, matches: [] };
    }
  }

  // 2️⃣ Anchors – DA prioritet före SE (sedan DE, EN)
  const langPriority = ["DA", "SE", "DE", "EN"];
  for (const lang of langPriority) {
    const anchors = regexAnchors[lang];
    const found = anchors.filter((a) => lower.includes(a));
    if (found.length) {
      const conf = found.length > 2 ? confidenceRules.strong : confidenceRules.medium;
      const result = { lang, via: "short-lexicon", confidence: conf, NeedsAI: false, matches: found };

      // 🧩 Mixed-language correction (Hej + English words)
      if (result.lang === "SE" && /how|are|you/.test(lower)) {
        logMessage("detect-lang.log", "⚖️ Mixed-language detected (SE + EN markers)");
        return { lang: "EN", via: "mixed-heuristic", confidence: 0.9, NeedsAI: false, matches: ["hej","how","are","you"] };
      }

      return result;
    }
  }

  // 3️⃣ No rule match → UNKNOWN, AI-fallback möjligt
  return { lang: "UNKNOWN", via: "regex", confidence: 0, NeedsAI: true, matches: [] };
}

// 🧪 Test samples för sanity-checks (manuella)
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
