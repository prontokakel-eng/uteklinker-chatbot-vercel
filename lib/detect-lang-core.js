// 🧩 PATCHED: detect-lang-core.js
// Hierarkisk språkdetektion: Regex → Heuristik → IP → AI
// Förbättrad determinism, mindre AI-användning, tydlig confidencehantering

import { getOpenAIClient } from "./openai-client.js";
import { detectLangRulesOnly } from "./detect-lang-rules.js";
import { detectLangHeuristicGroup } from "./detect-lang-heuristics.js";
import { detectLangFaqFuzzy } from "./faq-fuzzy-detect.js";
import { initFaqData } from "./faq-data.js";
import { logMessage } from "./logger.js";
import { getFaqCache } from "./faq-cache.js";

let faqReady = false;

function mapConfidence(via, lang) {
  switch (via) {
    case "regex-exclusive": return 1.0;
    case "heuristic+anchors": return 0.8;
    case "heuristic-group": return 0.7;
    case "ip-tiebreak": return 0.8;
    default: return lang === "UNKNOWN" ? 0.0 : 0.5;
  }
}

// 🧩 PATCH: ny struktur
export async function detectLangCore(input, opts = {}) {
  const { skipAI = false, ipCountryCode = null } = opts;
  const clean = input.trim();
  if (!clean) return { lang: "UNKNOWN", via: "empty", confidence: 0.0, NeedsAI: false };

  // 🔑 Initiera FAQ-data en gång
  if (!faqReady) {
    try {
      await initFaqData("detectLangCore");
      faqReady = true;
    } catch (err) {
      logMessage("detect-lang.log", `⚠️ Kunde inte init FAQ-data: ${err.message}`);
    }
  }

  // 1️⃣ Regex (direkt)
  const regexRes = await detectLangRulesOnly(clean);
  if (regexRes && regexRes.confidence >= 0.8) {
    logMessage("detect-lang.log", `✅ Regex träff: ${JSON.stringify(regexRes)}`);
    return regexRes;
  }

  // 2️⃣ Heuristik (anchors + whitelist i detect-lang-rules.js)
  let ruleRes = regexRes;
  if (ruleRes.confidence < 0.8) {
    ruleRes = await detectLangRulesOnly(clean);
    if (ruleRes && ruleRes.confidence >= 0.8) {
      logMessage("detect-lang.log", `✅ Heuristik träff: ${JSON.stringify(ruleRes)}`);
      return ruleRes;
    }
  }

  // 3️⃣ Gruppanalys (ny modul)
  const groupRes = detectLangHeuristicGroup(clean);
  if (groupRes && groupRes.confidence >= 0.8) {
    logMessage("detect-lang.log", `✅ Gruppdetektion: ${JSON.stringify(groupRes)}`);
    return groupRes;
  }

  // 4️⃣ IP-fallback (endast tiebreak)
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

  // 5️⃣ AI fallback
  if (!skipAI) {
    try {
      logMessage("detect-lang.log", `🤖 AI fallback aktiverad för input="${input}"`);
      const completion = await getOpenAIClient("detectLangCore")
        .chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "system", content: "Du är en språkdetektor. Svara endast med: SE, DA, DE, EN." },
            { role: "user", content: clean },
          ],
          max_tokens: 5,
          temperature: 0,
        });

      const langGuess = completion.choices[0].message.content.trim().toUpperCase();
      logMessage("detect-lang.log", `🤖 AI svar: "${langGuess}"`);

      if (["SE", "DA", "DE", "EN"].includes(langGuess)) {
        return {
          lang: langGuess,
          via: "ai-fallback",
          confidence: 0.9,
          NeedsAI: false,
        };
      }
    } catch (err) {
      logMessage("detect-lang.log", `⚠️ AI fallback failed: ${err.message}`);
    }
  }

  // 6️⃣ Default return
  logMessage("detect-lang.log", `⬅️ Default return: ${JSON.stringify(ruleRes)}`);
  return { ...ruleRes, confidence: mapConfidence(ruleRes.via, ruleRes.lang), NeedsAI: false };
}
