// 🧩 PATCHED v3: detect-lang-rules.js
// Förbättrad SE-precision, diakrit-stöd och högre vikt för “vilka/vilken/finns”

import { logMessage } from "./logger.js";

export const regexAnchors = {
  SE: [
    "hej", "hallå", "tack", "varför", "hur", "vilken", "vilka", "vad", "snälla",
    "kunde", "skulle", "gärna", "klinker", "platta", "plattor", "golv", "vägg",
    "dyr", "billig", "badrum", "utomhus", "inomhus", "färg", "färger", "mått",
    "serie", "ytstruktur", "ce", "märkning", "ce-märkning", "finns"
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

const boosters = {
  SE: ["vilka", "vilken", "finns", "ytstruktur", "serie", "plattorna", "ce", "märkning", "ce-märkning"],
  DA: ["hvilke", "leverer", "garanti", "skridsikring", "plader", "mål", "til"],
  DE: ["welche", "oberfläche", "feuerfest", "aus", "material", "größe"],
  EN: ["what", "which", "sizes", "material", "fireproof", "surface"]
};

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
  const normalized = lower.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  // === 1️⃣ Strong markers
  for (const [lang, patterns] of Object.entries(exclusiveRegex)) {
    if (patterns.some((rx) => rx.test(normalized))) {
      logMessage("detect-lang.log", `🔍 Strong marker detected: ${lang}`);
      return { lang, via: "regex-exclusive", confidence: confidenceRules.strong, NeedsAI: false, matches: [] };
    }
  }

  // === 2️⃣ Anchors (nu med högre vikt och normalized text)
  const langPriority = ["DA", "SE", "DE", "EN"];
  const scores = { SE: 0, DA: 0, DE: 0, EN: 0 };

  for (const lang of langPriority) {
    const anchors = regexAnchors[lang];
    for (const a of anchors) {
      if (normalized.includes(a)) {
        scores[lang] = (scores[lang] || 0) + 0.4; // 🧩 vikt höjd från 0.3 → 0.4
      }
    }
  }

  // === 3️⃣ Boosters
  for (const [lang, words] of Object.entries(boosters)) {
    for (const w of words) {
      if (normalized.includes(w)) scores[lang] = (scores[lang] || 0) + 0.15;
    }
  }

  // === 4️⃣ Vinnare
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestLang, score] = sorted[0];

  if (score === 0) {
    return { lang: "UNKNOWN", via: "regex", confidence: 0, NeedsAI: true, matches: [] };
  }

  let conf =
    score >= 0.8 ? confidenceRules.strong :
    score >= 0.5 ? confidenceRules.medium :
    confidenceRules.weak;

  // === 5️⃣ Mixed SE+EN correction
  if (bestLang === "SE" && /\bhow\b|\bare\b|\byou\b/.test(normalized)) {
    logMessage("detect-lang.log", "⚖️ Mixed-language detected (SE + EN markers)");
    return { lang: "EN", via: "mixed-heuristic", confidence: 0.9, NeedsAI: false, matches: ["hej","how","are","you"] };
  }

  // 🧩 Final boost for single-phrase questions (“vilka ...” etc)
  conf = Math.min(1, conf + 0.1);

  return { lang: bestLang, via: "short-lexicon", confidence: conf, NeedsAI: false, matches: [] };
}
