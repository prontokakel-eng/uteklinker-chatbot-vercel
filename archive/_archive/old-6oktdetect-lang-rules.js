// 🧩 PATCHED: detect-lang-rules.js
// Förbättrad hantering av korta ord (ja, hej, hi, ok etc.) via short-lexicon fallback

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import stringSimilarity from "string-similarity";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const whitelist = JSON.parse(
  fs.readFileSync(path.join(__dirname, "whitelist.json"), "utf8")
);
const whitelistAll = Array.isArray(whitelist)
  ? whitelist.map((w) => w.toLowerCase())
  : whitelist.ALL?.map((w) => w.toLowerCase()) || [];

const anchors = {
  SE: ["och", "måste", "från", "vilka", "hej", "inte"],
  DA: ["og", "jeg", "bruge", "hvilken", "hej", "ikke"],
  DE: ["und", "muss", "welche", "ich", "hallo", "nicht"],
  EN: ["and", "must", "what", "how", "hi", "hello", "can"],
};

const brandWords = ["klinkerdäck"];

// --- Regex detection ---
function regexDetect(text, brandNeutral = false) {
  if (/[æøÆØ]/.test(text)) return { lang: "DA", via: "regex-exclusive", confidence: 1.0 };
  if (/[üßÜẞ]/.test(text)) return { lang: "DE", via: "regex-exclusive", confidence: 1.0 };
  if (/[åäöÅÄÖ]/.test(text)) {
    if (brandNeutral) {
      const tokens = text.toLowerCase().split(/\s+/);
      const nonBrandHasAo = tokens.some(
        (t) => /[åäö]/.test(t) && !/klinkerdäck/.test(t)
      );
      if (!nonBrandHasAo) return null;
    }
    return { lang: "SE", via: "regex-exclusive", confidence: 1.0 };
  }
  return null;
}

// --- Anchors + whitelist ---
function heuristicDetect(text) {
  const words = text.toLowerCase().split(/\s+/);
  let bestLang = "UNKNOWN";
  let bestScore = 0;
  let bestMatches = [];

  for (const [lang, list] of Object.entries(anchors)) {
    let score = 0;
    let hits = [];

    for (const word of words) {
      const aMatch = stringSimilarity.findBestMatch(word, list);
      if (aMatch.bestMatch.rating >= 0.8) {
        score += 2;
        hits.push({ word, match: aMatch.bestMatch.target, rating: aMatch.bestMatch.rating });
      }
      if (whitelistAll.length > 0) {
        const wMatch = stringSimilarity.findBestMatch(word, whitelistAll);
        if (wMatch.bestMatch.rating > 0.9) {
          score += 0.5;
          hits.push({ word, match: wMatch.bestMatch.target, rating: wMatch.bestMatch.rating });
        }
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestLang = lang;
      bestMatches = hits;
    }
  }

  const conf =
    bestScore >= 6 ? 0.8 :
    bestScore >= 3 ? 0.6 :
    bestScore > 0 ? 0.5 : 0.0;

  return {
    lang: bestLang !== "UNKNOWN" ? bestLang : "UNKNOWN",
    via: bestLang !== "UNKNOWN" ? "heuristic+anchors" : "heuristic",
    confidence: conf,
    matches: bestMatches,
  };
}

// --- Main export ---
export async function detectLangRulesOnly(input, expectedLang = null) {
  if (!input || typeof input !== "string") {
    return { lang: "UNKNOWN", via: "invalid", confidence: 0.0, NeedsAI: false, matches: [] };
  }

  // 🧩 PATCH: kortord-fallback (fångar extremt korta inputs)
  const shortInput = input.trim().toLowerCase();
  if (shortInput.length <= 3) {
    const shortLex = {
      SE: ["ja", "nej", "hej", "tack"],
      DA: ["ja", "nej", "tak", "hej"],
      DE: ["ja", "nein", "danke", "hallo"],
      EN: ["hi", "ok", "no", "yes", "hey"],
    };
    for (const [lang, list] of Object.entries(shortLex)) {
      if (list.includes(shortInput)) {
        return { lang, via: "short-lexicon", confidence: 0.95, NeedsAI: false, matches: [] };
      }
    }
  }

  const text = input.toLowerCase();
  const containsBrand = brandWords.some((w) => text.includes(w));

  // 1️⃣ Regex
  let res = regexDetect(input, containsBrand);
  if (res) return { ...res, NeedsAI: false, matches: [] };

  // 2️⃣ Anchors
  res = heuristicDetect(input);

  // 3️⃣ Brand neutral fallback
  if (containsBrand && res.lang === "UNKNOWN") {
    return { lang: "UNKNOWN", via: "brand-neutral", confidence: 0.5, NeedsAI: true, matches: res.matches || [] };
  }

  // 4️⃣ Regex overrides
  if (res.lang === "SE" || res.lang === "UNKNOWN") {
    if (/benötigen|müssen|sie/i.test(text)) {
      return { lang: "DE", via: "regex-override", confidence: 1.0, NeedsAI: false, matches: res.matches || [] };
    }
  }

  // 5️⃣ Default
  return { ...res, NeedsAI: res.confidence < 0.7 };
}
