// /lib/block-long.js
import { logMessage } from "./logger.js";

// ------------------------------------------------------------
// 🧩 assessLongRepetitive(text)
// ------------------------------------------------------------
export function assessLongRepetitive(text) {
  const raw = String(text || "");
  const expanded = raw.replace(/\u2026/g, "..."); // … → ...
  const expandedLen = expanded.length;
  const dotCount = (expanded.match(/\./g) || []).length;

  // Tokenisering: behåll bokstäver/siffror och bindestreck (för "sanity-test")
  const words = (expanded.trim().match(/\S+/g) || []);
  const tokens = words
    .map(w => w.toLowerCase().replace(/[^a-zåäö0-9-]/gi, "")) // rensa “,” “.” etc.
    .filter(Boolean);

  const wordCount = tokens.length;
  const uniqueWords = new Set(tokens).size;
  const uniqueRatio = uniqueWords / Math.max(1, wordCount);

  // 🔎 Ny: explicit frekvens-check (fångar 3+ upprepningar av samma ord/term)
  let maxFreq = 0;
  if (tokens.length) {
    const freq = Object.create(null);
    for (const t of tokens) {
      if (t.length < 3) continue; // ignorera extremt kort brus
      freq[t] = (freq[t] || 0) + 1;
      if (freq[t] > maxFreq) maxFreq = freq[t];
    }
  }
  const hasTripleRepeat = maxFreq >= 3; // t.ex. "sanity-test" x3

  // Trösklar
  const MAX_LEN = 400;
  const MAX_DOTS = 80;
  const MAX_WORDS = 80;
  const MIN_UNIQUE_RATIO = 0.35;

  const isLong =
    expandedLen > MAX_LEN || wordCount > MAX_WORDS || dotCount > MAX_DOTS;

  // 💪 Repetitivt om:
  // - låg unikhetskvot ELLER
  // - minst ett ord upprepas 3+ ggr
  const isRepetitive = uniqueRatio < MIN_UNIQUE_RATIO || hasTripleRepeat;

  return {
    isLongOrRepetitive: isLong || isRepetitive,
    expandedLen,
    dotCount,
    wordCount,
    uniqueRatio,
    maxFreq
  };
}

// ------------------------------------------------------------
// 🧹 sanitizeInput(text)
// ------------------------------------------------------------
export function sanitizeInput(text) {
  return (text || "")
    .replace(/\b(\w+)(?:\s+\1){1,}\b/gi, "$1")
    .replace(/\b(?:very|really|please|test|text|long|again|sanity)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ------------------------------------------------------------
// ⚖️ countWhitelistHits(text, heavyOnly)
// ------------------------------------------------------------
export function countWhitelistHits(text, heavyOnly = false) {
  const wl = [
    { word: "fog", weight: 3 },
    { word: "kakel", weight: 3 },
    { word: "platta", weight: 2 },
    { word: "rengör", weight: 2 },
    { word: "frakt", weight: 2 },
    { word: "bruk", weight: 2 },
    { word: "lim", weight: 2 },
    { word: "granit", weight: 2 },
    { word: "test", weight: 0.5 },
    { word: "text", weight: 0.5 },
    { word: "delivery", weight: 0.5 },
    { word: "online", weight: 0.5 }
  ];

  const t = text.toLowerCase();
  const hits = wl.filter(({ word }) => t.includes(word));
  if (heavyOnly) return hits.filter(h => h.weight >= 2).length;
  return hits.length;
}

// ------------------------------------------------------------
// 🚫 shouldBlockLong(input, ip)
// ------------------------------------------------------------
export function shouldBlockLong(input, ip = "anon") {
  const sig = assessLongRepetitive(input);
  if (!sig.isLongOrRepetitive) return { block: false };

  const cleaned = sanitizeInput(input);
  const wlHits = countWhitelistHits(cleaned);
  const heavyHits = countWhitelistHits(cleaned, true);

  logMessage(
    "block-long.log",
    `[LONG-EVAL] IP=${ip} len=${sig.expandedLen} dots=${sig.dotCount} words=${sig.wordCount} ratio=${sig.uniqueRatio.toFixed(2)} maxFreq=${sig.maxFreq} wl=${wlHits} heavy=${heavyHits}`
  );

  // Policy: tillåt lång/repetitiv endast om ≥3 WL och ≥1 tung
  if (wlHits < 3 || heavyHits < 1) {
    return {
      block: true,
      via: "filtered-long",
      reason: "Din fråga är för lång eller repetitiv utan relevanta ord."
    };
  }

  return { block: false };
}
