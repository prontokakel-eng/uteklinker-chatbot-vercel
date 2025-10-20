// 🧩 PATCHED v6.3.3
// + Timeout-skydd (15s) vid AI-anrop
// + Loggar vilken OpenAI-klient som används första gången (nyckelkälla + prefix)

import { getOpenAIClient } from "./openai-client.js";
import * as detectRules from "./detect-lang-rules.js";
import { detectLangHeuristicGroup } from "./detect-lang-heuristics.js";
import { detectLangFaqFuzzy } from "./faq-fuzzy-detect.js";
import { initFaqData } from "./faq-data.js";
import { logMessage } from "./logger.js";
import { getFaqCache } from "./faq-cache.js";
import { normalizeText } from "./text-normalize.js";
import { loadLexicon } from "../config/lexicon/lexicon-loader.js";
import { withTimeout } from "./utils/withTimeout.js"; // ✅ Ny import

let faqReady = false;
let __openaiLogged = false; // 🔧 tillagd flagga för engångsloggning

const LANGS = ["SE", "DA", "DE", "EN"];
function makeScores() { return { SE: 0, DA: 0, DE: 0, EN: 0 }; }
function bumpScore(scores, lang, value) {
  if (!lang || !LANGS.includes(lang)) return;
  scores[lang] = Math.max(0, (scores[lang] || 0) + Number(value || 0));
}

function mapConfidence(via, lang) {
  switch (via) {
    case "regex-exclusive": return 1.0;
    case "heuristic+anchors": return 0.8;
    case "heuristic-group": return 0.7;
    case "ip-tiebreak": return 0.8;
    case "geo-boost": return 0.82;
    default: return lang === "UNKNOWN" ? 0.0 : 0.5;
  }
}

async function langFromGeo(ipCountryCode) {
  if (!ipCountryCode) return null;
  const cc = String(ipCountryCode).toUpperCase();
  const [SE, EN, DA, DE] = await Promise.all([
    loadLexicon("SE"),
    loadLexicon("EN"),
    loadLexicon("DA"),
    loadLexicon("DE"),
  ]);

  const test = (lex) => {
    const gm = lex?.geoMapping;
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
  const __scores = makeScores();
  const attachScores = (ret) => {
    if (process.env.NODE_ENV === "test" || opts.exposeScores === true) {
      return { ...ret, scores: { ...__scores } };
    }
    return ret;
  };

  const { skipAI = false, ipCountryCode = null } = opts;
  const cleanInput = normalizeText(input || "").toLowerCase();
  if (!cleanInput) return { lang: "UNKNOWN", via: "empty", confidence: 0.0, NeedsAI: false };
  const normalizedInput = cleanInput.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

  if (!faqReady) {
    try {
      faqReady = true;
    } catch (err) {
      logMessage("detect-lang.log", `⚠️ Kunde inte init FAQ-data: ${err.message}`);
    }
  }

  const regexRes = await detectRules.detectLangRulesOnly(cleanInput);
  if (regexRes && regexRes.confidence >= 0.8) {
    logMessage("detect-lang.log", `✅ Regex träff: ${JSON.stringify(regexRes)}`);
    bumpScore(__scores, regexRes.lang, 1.0);
    return attachScores(regexRes);
  }

  let ruleRes = regexRes;
  if (ruleRes.confidence < 0.8) {
    const heurRes = detectLangHeuristicGroup(cleanInput);
    if (heurRes && heurRes.confidence >= 0.8) {
      logMessage("detect-lang.log", `✅ Heuristik träff: ${JSON.stringify(heurRes)}`);
      bumpScore(__scores, heurRes.lang, 0.8);
      return attachScores(heurRes);
    }
    ruleRes = heurRes || ruleRes;
  }

  if (ruleRes.confidence < 0.8 && ipCountryCode) {
    try {
      const geoLang = await langFromGeo(ipCountryCode);
      if (geoLang) {
        if (ruleRes.lang === geoLang) {
          const boosted = { ...ruleRes, via: "geo-boost", confidence: Math.max(ruleRes.confidence, 0.82), NeedsAI: false };
          logMessage("detect-lang.log", `🌍 Geo boost confirm (${ipCountryCode} → ${geoLang})`);
          bumpScore(__scores, geoLang, 0.3);
          return attachScores(boosted);
        } else if (!ruleRes.lang || ruleRes.lang === "UNKNOWN" || ruleRes.confidence < 0.7) {
          const swapped = { lang: geoLang, via: "geo-boost", confidence: 0.82, NeedsAI: false };
          logMessage("detect-lang.log", `🌍 Geo boost swap (${ipCountryCode} → ${geoLang}, from=${ruleRes.lang || "∅"})`);
          bumpScore(__scores, geoLang, 0.4);
          return attachScores(swapped);
        }
        logMessage("detect-lang.log", `🌍 Geo hint ignored (conf=${ruleRes.confidence}, want=${ruleRes.lang}, geo=${geoLang})`);
      }
    } catch (e) {
      logMessage("detect-lang.log", `⚠️ Geo boost failed: ${e?.message || e}`);
    }
  }

  const groupRes = detectLangHeuristicGroup(cleanInput);
  if (groupRes && groupRes.confidence >= 0.8) {
    logMessage("detect-lang.log", `✅ Gruppdetektion: ${JSON.stringify(groupRes)}`);
    bumpScore(__scores, groupRes.lang, 0.6);
    return attachScores(groupRes);
  }

  if (process.env.NODE_ENV === "test") {
    try {
      const dbg = { step: "pre-ip-fallback", ruleRes, ipCountryCode, geoLang: await langFromGeo(ipCountryCode) };
      console.log("[detect-lang-core] debug:", JSON.stringify(dbg));
    } catch {}
  }

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
      const ipRes = { lang: ipLang, via: "ip-tiebreak", confidence: 0.8, NeedsAI: false };
      bumpScore(__scores, ipLang, 0.5);
      return attachScores(ipRes);
    }
  }

  if (!skipAI) {
    try {
      logMessage("detect-lang.log", `🤖 AI fallback aktiverad för input="${input}"`);
      const openai = getOpenAIClient("detectLangCore");

      if (!__openaiLogged) {
        const prefix = openai.apiKey ? openai.apiKey.slice(0, 10) + "..." : "❌ undefined";
        const src = process.env.VERCEL === "1"
          ? "Vercel (CLI injected)"
          : process.env.OPENAI_API_KEY
          ? "System/Powershell"
          : ".env.local";
        logMessage("detect-lang.log", `🔍 OpenAI client origin: ${src} (key prefix: ${prefix})`);
        __openaiLogged = true;
      }

      // ✅ Timeout-skyddat AI-anrop
      const completion = await withTimeout(
        openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Du är en språkdetektor. Svara endast med: SE, DA, DE, EN." },
            { role: "user", content: cleanInput },
          ],
          max_tokens: 5,
          temperature: 0,
        }),
        15000
      );

      const langGuess = completion.choices[0].message.content.trim().toUpperCase();
      logMessage("detect-lang.log", `🤖 AI svar: \"${langGuess}\"`);
      if (["SE", "DA", "DE", "EN"].includes(langGuess)) {
        const aiRes = { lang: langGuess, via: "ai-fallback", confidence: 0.9, NeedsAI: false };
        bumpScore(__scores, langGuess, 0.7);
        return attachScores(aiRes);
      }
    } catch (err) {
      logMessage("detect-lang.log", `⚠️ AI fallback failed: ${err.message}`);
    }
  }

  logMessage("detect-lang.log", `⬅️ Default return: ${JSON.stringify(ruleRes)}`);
  bumpScore(__scores, ruleRes?.lang, 0.4);
  return attachScores({ ...ruleRes, confidence: mapConfidence(ruleRes.via, ruleRes.lang), NeedsAI: false });
}

export async function __test_langFromGeo(code) {
  return langFromGeo(code);
}