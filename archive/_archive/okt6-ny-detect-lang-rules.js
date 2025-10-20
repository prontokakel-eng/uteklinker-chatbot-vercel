// 🧩 /lib/detect-lang-rules.js
// Regelbaserad språkdetektion (regex & ankare)
// Förbättrad version med optimerade DA/EN-ankare – 2025-10-06

export const regexAnchors = {
  SE: [
    "hej", "hallå", "tack", "varför", "hur", "vilken", "vad", "snälla",
    "kunde", "skulle", "gärna", "klinker", "platta", "golv", "vägg", "dyr",
    "billig", "badrum", "utomhus", "inomhus", "färg", "storlek"
  ],
  DA: [
    "hvordan", "hvilken", "hvad", "hvorfor", "hvem",
    "ikke", "bedst", "fliser", "tak", "klinker", "udendørs", "indendørs",
    "billig", "farve", "størrelse", "gulv", "væg"
  ],
  DE: [
    "welche", "warum", "wie", "danke", "fliesen", "frost", "badezimmer",
    "teuer", "preis", "grösse", "größe", "wand", "boden", "außen", "innen"
  ],
  EN: [
    "why", "how", "what", "which", "are", "tiles", "expensive", "cheap",
    "bathroom", "indoor", "outdoor", "floor", "wall", "color", "size",
    "thanks", "hello", "hi", "good", "morning", "evening", "best"
  ]
};

// 🧩 Exclusive regex per språk
// Dessa används för tydliga språkmarkörer som inte bör blandas
export const exclusiveRegex = {
  SE: [/å/, /ä/, /ö/, /varför/, /tack/],
  DA: [/hvordan/, /hvilken/, /hvad/, /hvorfor/, /hvem/],
  DE: [/welche/, /ß/, /sch/, /nicht/, /und/],
  EN: [/why/, /how/, /the/, /ing/, /you/]
};

// 🧮 Confidence-rules – används för finjustering
export const confidenceRules = {
  strong: 1.0,
  medium: 0.8,
  weak: 0.5
};

// 🧩 Hjälpfunktion: använd av detectLangRulesOnly()
export function detectLangRulesOnly(text = "") {
  if (!text || typeof text !== "string") return { lang: "UNKNOWN", via: "regex", confidence: 0 };

  const lower = text.toLowerCase();

  // 1️⃣ Regex exclusive – snabbmatch
  for (const [lang, patterns] of Object.entries(exclusiveRegex)) {
    if (patterns.some((rx) => rx.test(lower))) {
      return { lang, via: "regex-exclusive", confidence: confidenceRules.strong, NeedsAI: false, matches: [] };
    }
  }

  // 2️⃣ Anchors
  for (const [lang, anchors] of Object.entries(regexAnchors)) {
    const found = anchors.filter((a) => lower.includes(a));
    if (found.length) {
      const conf = found.length > 2 ? confidenceRules.strong : confidenceRules.medium;
      return { lang, via: "short-lexicon", confidence: conf, NeedsAI: false, matches: found };
    }
  }

  return { lang: "UNKNOWN", via: "regex", confidence: 0, NeedsAI: true, matches: [] };
}

// 🧪 Test samples för sanity-checks (manuella)
// Dessa används EJ i produktionskod – endast för test/debug
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
    "How are you doing today?", "Why are tiles so expensive?", "Thanks a lot!"
  ]
};
