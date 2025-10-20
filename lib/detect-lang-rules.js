// 🧩 PATCHED v6.2: detect-lang-rules.js
// Finjustering efter benchmark:
// + stärkta vikter för SE
// + utökade DA/DE markörer
// + bibehållen språkbevarande normalisering från v6.1

import { logMessage } from "./logger.js";

function neutralizeBrandTerms(text) {
  return text.replace(/klinkerd[äa]ck/gi, " ");
}

export const regexAnchors = {
  SE: [
    "hej", "hallå", "tack", "varför", "hur", "vilken", "vilka", "vad", "snälla",
    "kunde", "skulle", "gärna", "platta", "plattor", "golv", "vägg",
    "dyr", "billig", "badrum", "utomhus", "inomhus", "färg", "färger",
    "mått", "serie", "ytstruktur", "ce", "märkning", "ce-märkning", "finns",
    "plattorna", "fog", "kakel"
  ],
  DA: [
    "hvordan", "hvilken", "hvilke", "hvad", "hvorfor", "hvem", "tak",
    "ikke", "bedst", "fliser", "tag", "klinker", "udendørs", "indendørs",
    "billig", "farve", "størrelse", "gulv", "væg", "æ", "ø", "skrid", "garanti"
  ],
  DE: [
    "welche", "warum", "wie", "danke", "fliesen", "frost", "badezimmer",
    "teuer", "preis", "groesse", "grösse", "größe", "wand", "boden",
    "aussen", "außen", "innen", "nicht", "und", "aber", "ü", "ß", "qualität"
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
  DA: ["hvilke", "leverer", "garanti", "skridsikring", "plader", "mål", "til", "fliserne"],
  DE: ["welche", "oberfläche", "feuerfest", "aus", "material", "größe", "grösse", "groesse", "frost", "badezimmer"],
  EN: ["what", "which", "sizes", "material", "fireproof", "surface"]
};

export const exclusiveRegex = {
  SE: [/\bvarför\b/, /\btack\b/, /[åäö]/],
  DA: [/\bhvordan\b/, /\bhvilken\b/, /\bhvilke\b/, /\bhvad\b/, /\bhvorfor\b/, /\bhvem\b/, /æ/, /ø/, /\bikke\b/],
  DE: [/\bwelche\b/, /ß/, /ü/, /\bnicht\b/, /\bund\b/, /\baber\b/, /\bgr(o|ö|oe)sse\b/],
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

  const cleaned = neutralizeBrandTerms(text.toLowerCase());

  // 🧩 v6.1 språkbevarande normalisering
  const normalized = cleaned
    .normalize("NFD")
    .replace(/[\u0301\u0300\u0302\u0303]/g, "")
    .replace(/[áàâã]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôõ]/g, "o")
    .replace(/[úùû]/g, "u")
    .replace(/[ç]/g, "c"); // franska cédille

  // === 1️⃣ Strong markers
  for (const [lang, patterns] of Object.entries(exclusiveRegex)) {
    if (patterns.some((rx) => rx.test(normalized))) {
      logMessage("detect-lang.log", `🔍 Strong marker detected: ${lang}`);
      return { lang, via: "regex-exclusive", confidence: confidenceRules.strong, NeedsAI: false, matches: [] };
    }
  }

  // === 2️⃣ Lexikonpoäng (justerade vikter)
  const langPriority = ["DA", "SE", "DE", "EN"];
  const scores = { SE: 0, DA: 0, DE: 0, EN: 0 };

  for (const lang of langPriority) {
    const anchors = regexAnchors[lang];
    for (const a of anchors) {
      if (normalized.includes(a)) {
        let weight = 0.4;
        if (lang === "DE") weight = 0.55;
        if (lang === "SE") weight = 0.45; // 🧩 stärkt svenskvikt
        scores[lang] += weight;
      }
    }
  }

  // === 3️⃣ Boosters
  for (const [lang, words] of Object.entries(boosters)) {
    for (const w of words) {
      if (normalized.includes(w)) scores[lang] += 0.15;
    }
  }

  // === 4️⃣ Startordsbooster för SE
  if (/^(vilka|vilken|finns|har|är|kan|går|hur fungerar|vad är|vad heter|när|var|hur)\b/.test(normalized)) {
    scores.SE += 0.4;
  }

  // === 5️⃣ Välj vinnare
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [bestLang, score] = sorted[0];
  if (score === 0) {
    return { lang: "UNKNOWN", via: "regex", confidence: 0, NeedsAI: true, matches: [] };
  }

  let conf =
    score >= 0.8 ? confidenceRules.strong :
    score >= 0.5 ? confidenceRules.medium :
    confidenceRules.weak;

  // === 6️⃣ Mixed SE↔EN correction
  if (bestLang === "SE" && /\bhow\b|\bare\b|\byou\b/.test(normalized)) {
    logMessage("detect-lang.log", "⚖️ Mixed-language detected (SE + EN markers)");
    return { lang: "EN", via: "mixed-heuristic", confidence: 0.9, NeedsAI: false, matches: ["hej","how","are","you"] };
  }

  conf = Math.min(1, conf + 0.1);

  return { lang: bestLang, via: "short-lexicon", confidence: conf, NeedsAI: false, matches: [] };
}
