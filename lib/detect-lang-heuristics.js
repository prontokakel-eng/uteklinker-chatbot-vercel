// 🧩 PATCHED: detect-lang-heuristics.js
// Förbättrad heuristik för korta svenska frågor och diakriter

// 🧩 CHANGE: importera lexikonloader (minimal diff, inga borttag)
import { loadLexicon } from "../config/lexicon/lexicon-loader.js"; // CHANGE

// 🧩 CHANGE: importera normalizeText från stödfilen (eliminerar cykel)
import { normalizeText } from "./text-normalize.js"; // CHANGE

// 🧩 CHANGE: cache för lexikon
const _LEX_CACHE = {}; // CHANGE
async function getLex(lang) { // CHANGE
  if (_LEX_CACHE[lang]) return _LEX_CACHE[lang];
  const lex = await loadLexicon(lang);
  _LEX_CACHE[lang] = lex || {};
  return _LEX_CACHE[lang];
}

export function detectLangHeuristicGroup(input) {
  if (!input || typeof input !== "string") {
    return { lang: "UNKNOWN", via: "heuristic-group", confidence: 0.0 };
  }

  const txt = input.toLowerCase();
  const scores = { SE: 0, DA: 0, DE: 0, EN: 0 };

  // === Diakritiska markörer
  if (/[åäö]/.test(txt)) scores.SE += 0.4;
  if (/[æø]/.test(txt)) scores.DA += 0.4;
  if (/[üöß]/.test(txt)) scores.DE += 0.4;
  if (/( th|the |and |you |your |not |will )/.test(txt)) scores.EN += 0.4;

  // === Frekventa ord
  const seWords = ["varför", "eftersom", "inte", "och", "hej", "vilka", "vilken", "finns"];
  const daWords = ["hvorfor", "fordi", "ikke", "og", "hej"];
  const deWords = ["warum", "nicht", "und", "aber"];
  const enWords = ["why", "because", "not", "and", "how", "are", "you", "what", "can", "will"];

  for (const w of seWords) if (txt.includes(w)) scores.SE += 0.2;
  for (const w of daWords) if (txt.includes(w)) scores.DA += 0.2;
  for (const w of deWords) if (txt.includes(w)) scores.DE += 0.2;
  for (const w of enWords) if (txt.includes(w)) scores.EN += 0.2;

  // === 🧩 Korttextboost (1–3 ord med diakriter)
  if (txt.split(/\s+/).length <= 3 && /[åäö]/.test(txt)) scores.SE += 0.3;

  // === Blandtext: "Hej, how are you?"
  const englishTokens = (txt.match(/\b(?:the|how|are|you|what|can|will|not)\b/g) || []).length;
  const swedishTokens = (txt.match(/\b(?:hej|och|inte|varför|eftersom|vilka|finns)\b/g) || []).length;
  if (englishTokens > 1 && englishTokens > swedishTokens) {
    scores.EN += 0.4;
    scores.SE -= 0.2;
  }

  // === Bestäm vinnare
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const [topLang, topScore] = sorted[0];

  const confidence =
    topScore >= 0.7 ? topScore :
    topScore >= 0.5 ? 0.6 :
    topScore > 0.3 ? 0.5 : 0.4;

  return { lang: topLang, via: "heuristic-group", confidence };
}

// ──────────────────────────────────────────────────────────────────────────────
// 🧩 CHANGE: Ny, lexikonbaserad "basic token-level heuristics"
// Behåller all gammal logik orörd; denna export kan användas av core/rules.
// ──────────────────────────────────────────────────────────────────────────────
export async function detectHeuristics(text) { // CHANGE
  const scores = { SE: 0, EN: 0, DA: 0, DE: 0 };
  if (!text || typeof text !== "string") return scores;

  const tokens = normalizeText(text).split(/\s+/);

  // Ladda lexikon (cacheat)
  const [LEX_SE, LEX_EN, LEX_DA, LEX_DE] = await Promise.all([
    getLex("SE"), getLex("EN"), getLex("DA"), getLex("DE")
  ]);

  // Viktning per token mot lexikonlistor/regex
  for (const token of tokens) {
    const t = token.toLowerCase();

    // === Swedish ===
    if (LEX_SE.common?.includes(t))    scores.SE += LEX_SE.weights?.common    ?? 0.2;
    if (LEX_SE.articles?.includes(t))  scores.SE += LEX_SE.weights?.articles  ?? 0.3;
    if (LEX_SE.negations?.includes(t)) scores.SE += LEX_SE.weights?.negations ?? 0.2;
    for (const re of LEX_SE.regex?.suffix || [])
      try { if (new RegExp(re, "i").test(t)) scores.SE += LEX_SE.weights?.regex ?? 0.3; } catch {}
    for (const re of LEX_SE.regex?.prefix || [])
      try { if (new RegExp(re, "i").test(t)) scores.SE += LEX_SE.weights?.regex ?? 0.3; } catch {}

    // === English ===
    if (LEX_EN.common?.includes(t))    scores.EN += LEX_EN.weights?.common    ?? 0.2;
    if (LEX_EN.articles?.includes(t))  scores.EN += LEX_EN.weights?.articles  ?? 0.3;
    if (LEX_EN.negations?.includes(t)) scores.EN += LEX_EN.weights?.negations ?? 0.2;
    for (const re of LEX_EN.regex?.suffix || [])
      try { if (new RegExp(re, "i").test(t)) scores.EN += LEX_EN.weights?.regex ?? 0.3; } catch {}
    for (const re of LEX_EN.regex?.prefix || [])
      try { if (new RegExp(re, "i").test(t)) scores.EN += LEX_EN.weights?.regex ?? 0.3; } catch {}

    // === Danish ===
    if (LEX_DA.common?.includes(t))    scores.DA += LEX_DA.weights?.common    ?? 0.2;
    if (LEX_DA.articles?.includes(t))  scores.DA += LEX_DA.weights?.articles  ?? 0.3;
    if (LEX_DA.negations?.includes(t)) scores.DA += LEX_DA.weights?.negations ?? 0.2;
    for (const re of LEX_DA.regex?.suffix || [])
      try { if (new RegExp(re, "i").test(t)) scores.DA += LEX_DA.weights?.regex ?? 0.3; } catch {}
    for (const re of LEX_DA.regex?.prefix || [])
      try { if (new RegExp(re, "i").test(t)) scores.DA += LEX_DA.weights?.regex ?? 0.3; } catch {}

    // === German ===
    if (LEX_DE.common?.includes(t))    scores.DE += LEX_DE.weights?.common    ?? 0.2;
    if (LEX_DE.articles?.includes(t))  scores.DE += LEX_DE.weights?.articles  ?? 0.3;
    if (LEX_DE.negations?.includes(t)) scores.DE += LEX_DE.weights?.negations ?? 0.2;
    for (const re of LEX_DE.regex?.suffix || [])
      try { if (new RegExp(re, "i").test(t)) scores.DE += LEX_DE.weights?.regex ?? 0.3; } catch {}
    for (const re of LEX_DE.regex?.prefix || [])
      try { if (new RegExp(re, "i").test(t)) scores.DE += LEX_DE.weights?.regex ?? 0.3; } catch {}
  }

  // Fallback-varning om inga träffar
  const sum = Object.values(scores).reduce((a, b) => a + b, 0);
  if (sum === 0 && typeof console !== "undefined") {
    console.warn("[detect-lang-heuristics] ⚠️ No lexicon matched; fallback triggered.");
  }

  return scores;
}
