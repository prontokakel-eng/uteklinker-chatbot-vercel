/**
 * detectLangRulesOnly
 * Regelbaserad språkdetektor för tester.
 * - Regex: åäö → SE, æø → DA, üß → DE
 * - Små språkankare per språk
 * - Brand-neutralisering för "klinkerdäck"
 * - Regex-overrides (t.ex. benötigen/müssen/sie → DE)
 * - Ingen IP, ingen AI, ingen kluster, ingen grammatik
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import stringSimilarity from "string-similarity";

// ESM-safe __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- Load whitelist (ALL) ---
const whitelist = JSON.parse(
  fs.readFileSync(path.join(__dirname, "whitelist.json"), "utf8")
);
const whitelistAll = Array.isArray(whitelist)
  ? whitelist.map((w) => w.toLowerCase())
  : whitelist.ALL?.map((w) => w.toLowerCase()) || [];

// --- Språkankare ---
const anchors = {
  SE: ["och", "måste", "från", "vilka", "hej", "inte"],
  DA: ["og", "jeg", "bruge", "hvilken", "hej", "ikke"],
  DE: ["und", "muss", "welche", "ich", "hallo", "nicht"],
  EN: ["and", "must", "what", "how", "hi", "hello", "can"],
};

// Brand-ord
const brandWords = ["klinkerdäck"];

// --- Regex detection ---
function regexDetect(text, brandNeutral = false) {
  if (/[æøÆØ]/.test(text)) return { lang: "DA", via: "regex-exclusive" };
  if (/[üßÜẞ]/.test(text)) return { lang: "DE", via: "regex-exclusive" };

  if (/[åäöÅÄÖ]/.test(text)) {
    if (brandNeutral) {
      const tokens = text.toLowerCase().split(/\s+/);
      const nonBrandHasAo = tokens.some(
        (t) => /[åäö]/.test(t) && !/klinkerdäck/.test(t)
      );
      if (!nonBrandHasAo) return null;
    }
    return { lang: "SE", via: "regex-exclusive" };
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

  return {
    lang: bestLang !== "UNKNOWN" ? bestLang : "UNKNOWN",
    via: bestLang !== "UNKNOWN" ? "heuristic+anchors" : "heuristic",
    matches: bestMatches,
  };
}

// --- Confidence estimation ---
function estimateConfidence(res) {
  switch (res.via) {
    case "regex-exclusive": return 1.0;
    case "heuristic+anchors": return 0.7;
    case "heuristic": return 0.5;
    default: return res.lang === "UNKNOWN" ? 0.0 : 0.5;
  }
}

// --- Main export ---
export async function detectLangRulesOnly(input, expectedLang = null) {
  if (!input || typeof input !== "string") {
    return { lang: "UNKNOWN", via: "invalid", confidence: 0.0, NeedsAI: false, matches: [] };
  }

  const text = input.toLowerCase();
  const containsBrand = brandWords.some((w) => text.includes(w));

  // 1. Regex
  let res = regexDetect(input, containsBrand);
  if (res) return { ...res, confidence: 1.0, NeedsAI: false, matches: [] };

  // 2. Anchors
  res = heuristicDetect(input);
  const conf = estimateConfidence(res);

  // 3. Brand neutral fallback
  if (containsBrand && res.lang === "UNKNOWN") {
    return { lang: "UNKNOWN", via: "brand-neutral", confidence: 0.5, NeedsAI: true, matches: res.matches || [] };
  }

  // 4. Regex overrides
  if (res.lang === "SE" || res.lang === "UNKNOWN") {
    if (/benötigen|müssen|sie/i.test(text)) {
      return { lang: "DE", via: "regex-override", confidence: 1.0, NeedsAI: false, matches: res.matches || [] };
    }
  }

  // 5. Default
  return { ...res, confidence: conf, NeedsAI: conf < 0.7 };
}
