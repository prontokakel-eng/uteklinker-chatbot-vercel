// 🧩 PATCHED v6.3.2
// Ändringar (minimal diff, ingen logik borttagen):
// 1) CENTRAL NORMALISERING: använder normalizeText (fanns i tidigare patch).
// 2) GEO-BOOST: nytt försiktigt steg före IP-tiebreak (använder geoMapping från lexikon).
//    - Byter till geo-språk om heuristik är svag (conf < 0.70) eller okänd.
//    - Om samma språk ⇒ höjer confidence lite (0.82).
// 3) DEBUG: tydlig testlogg (NODE_ENV==='test') innan IP-fallback för att se geo-utfall.
// 4) TEST-HELPER: exporterar __test_langFromGeo(code) för snabb verifiering.
//    (påverkar ej prodlogik)

import { getOpenAIClient } from "./openai-client.js";
import * as detectRules from "./detect-lang-rules.js";
import { detectLangHeuristicGroup } from "./detect-lang-heuristics.js";
import { detectLangFaqFuzzy } from "./faq-fuzzy-detect.js";
import { initFaqData } from "./faq-data.js";
import { logMessage } from "./logger.js";
import { getFaqCache } from "./faq-cache.js";

// CHANGE: centraliserad normalisering
import { normalizeText } from "./text-normalize.js";

// CHANGE: lexikon för geoMapping-boost
import { loadLexicon } from "../config/lexicon/lexicon-loader.js";

let faqReady = false;

function mapConfidence(via, lang) {
  switch (via) {
    case "regex-exclusive": return 1.0;
    case "heuristic+anchors": return 0.8;
    case "heuristic-group": return 0.7;
    case "ip-tiebreak": return 0.8;
    case "geo-boost": return 0.82; // CHANGE: liten puff när geo bekräftar
    default: return lang === "UNKNOWN" ? 0.0 : 0.5;
  }
}

// CHANGE: hämta ev. språk från geoMapping givet landkod (ex: "SE","DK","DE","GB")
async function langFromGeo(ipCountryCode) {
  if (!ipCountryCode) return null;
  const cc = String(ipCountryCode).toUpperCase();

  // Ladda lexikon för alla fyra (cache:as i loadern)
  const [SE, EN, DA, DE] = await Promise.all([
    loadLexicon("SE"),
    loadLexicon("EN"),
    loadLexicon("DA"),
    loadLexicon("DE")
  ]);

  const test = (lex) => {
    const gm = lex?.geoMapping; // { "SE": true, "DK": true, ... } eller liknande
    if (!gm || typeof gm !== "object") return false;
    return Object.prototype.hasOwnProperty.call(gm, cc);
  };

  if (test(SE)) return "SE";
  if (test(DA)) return "DA";
  if (test(DE)) return "DE";
  if (test(EN)) return "EN";
  return null;
}

export async function detectLangCore(input, opts = {}) {
  const { skipAI = false, ipCountryCode = null } = opts;

  // CHANGE: använd delad normalisering + behåll lowercase-beteendet
  const cleanInput = normalizeText(input || "").toLowerCase();
  if (!cleanInput) return { lang: "UNKNOWN", via: "empty", confidence: 0.0, NeedsAI: false };

  // (behåll latent NFD-strip om någon downstream förlitar sig på detta)
  const normalizedInput = cleanInput.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (!faqReady) {
    try {
      await initFaqData("detectLangCore");
      faqReady = true;
    } catch (err) {
      logMessage("detect-lang.log", `⚠️ Kunde inte init FAQ-data: ${err.message}`);
    }
  }

  // 1️⃣ Regex
  const regexRes = await detectRules.detectLangRulesOnly(cleanInput);
  if (regexRes && regexRes.confidence >= 0.8) {
    logMessage("detect-lang.log", `✅ Regex träff: ${JSON.stringify(regexRes)}`);
    return regexRes;
  }

  // 2️⃣ Heuristik
  let ruleRes = regexRes;
  if (ruleRes.confidence < 0.8) {
    const heurRes = detectLangHeuristicGroup(cleanInput);
    if (heurRes && heurRes.confidence >= 0.8) {
      logMessage("detect-lang.log", `✅ Heuristik träff: ${JSON.stringify(heurRes)}`);
      return heurRes;
    }
    ruleRes = heurRes || ruleRes;
  }

  // 2.5️⃣ CHANGE: geoMapping-boost om osäkert + IP finns
  if (ruleRes.confidence < 0.8 && ipCountryCode) {
    try {
      const geoLang = await langFromGeo(ipCountryCode);
      if (geoLang) {
        if (ruleRes.lang === geoLang) {
          // Samma som heuristiken → bara höj lite
          const boosted = { ...ruleRes, via: "geo-boost", confidence: Math.max(ruleRes.confidence, 0.82), NeedsAI: false };
          logMessage("detect-lang.log", `🌍 Geo boost confirm (${ipCountryCode} → ${geoLang})`);
          return boosted;
        } else if (!ruleRes.lang || ruleRes.lang === "UNKNOWN" || ruleRes.confidence < 0.70) { // CHANGE: 0.75→0.70 + UNKNOWN
          // Heuristik svag/okänd → våga byta
          const swapped = { lang: geoLang, via: "geo-boost", confidence: 0.82, NeedsAI: false };
          logMessage("detect-lang.log", `🌍 Geo boost swap (${ipCountryCode} → ${geoLang}, from=${ruleRes.lang || '∅'})`);
          return swapped;
        }
        // Annars behåll heuristiken och notera
        logMessage("detect-lang.log", `🌍 Geo hint ignored (conf=${ruleRes.confidence}, want=${ruleRes.lang}, geo=${geoLang})`);
      }
    } catch (e) {
      logMessage("detect-lang.log", `⚠️ Geo boost failed: ${e?.message || e}`);
    }
  }

  // 3️⃣ Gruppanalys (kvar oförändrat för kompatibilitet)
  const groupRes = detectLangHeuristicGroup(cleanInput);
  if (groupRes && groupRes.confidence >= 0.8) {
    logMessage("detect-lang.log", `✅ Gruppdetektion: ${JSON.stringify(groupRes)}`);
    return groupRes;
  }

  // CHANGE (debug): visa vad geo gav och hur stark heuristiken var innan IP-fallback
  if (process.env.NODE_ENV === 'test') {
    try {
      const dbg = { step: 'pre-ip-fallback', ruleRes, ipCountryCode, geoLang: await langFromGeo(ipCountryCode) };
      // eslint-disable-next-line no-console
      console.log('[detect-lang-core] debug:', JSON.stringify(dbg));
    } catch {}
  }

  // 4️⃣ IP-fallback (oförändrat)
  if (ipCountryCode) {
    let ipLang = null;
    switch (ipCountryCode.toUpperCase()) {
      case "SE": ipLang = "SE"; break;
      case "DK": ipLang = "DA"; break;
      case "DE": ipLang = "DE"; break;
      case "GB":
      case "US":
      case "AU":
      case "CA": ipLang = "EN"; break;
    }
    if (ipLang) {
      logMessage("detect-lang.log", `🌍 IP-tiebreak (${ipCountryCode} → ${ipLang})`);
      return { lang: ipLang, via: "ip-tiebreak", confidence: 0.8, NeedsAI: false };
    }
  }

  // 5️⃣ AI fallback (oförändrat)
  if (!skipAI) {
    try {
      logMessage("detect-lang.log", `🤖 AI fallback aktiverad för input="${input}"`);
      const openai = getOpenAIClient("detectLangCore");
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: "Du är en språkdetektor. Svara endast med: SE, DA, DE, EN." },
          { role: "user", content: cleanInput },
        ],
        max_tokens: 5,
        temperature: 0,
      });
      const langGuess = completion.choices[0].message.content.trim().toUpperCase();
      logMessage("detect-lang.log", `🤖 AI svar: "${langGuess}"`);
      if (["SE", "DA", "DE", "EN"].includes(langGuess)) {
        return { lang: langGuess, via: "ai-fallback", confidence: 0.9, NeedsAI: false };
      }
    } catch (err) {
      logMessage("detect-lang.log", `⚠️ AI fallback failed: ${err.message}`);
    }
  }

  // 6️⃣ Default
  logMessage("detect-lang.log", `⬅️ Default return: ${JSON.stringify(ruleRes)}`);
  return { ...ruleRes, confidence: mapConfidence(ruleRes.via, ruleRes.lang), NeedsAI: false };
}

// CHANGE (test-only helper): exponera geo-lookup för snabb verifiering
export async function __test_langFromGeo(code) {
  return langFromGeo(code);
}
