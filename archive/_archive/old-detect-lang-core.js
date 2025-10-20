// lib/detect-lang-core.js
import { getOpenAIClient } from "./openai-client.js";
import { detectLangRulesOnly } from "./detect-lang-rules.js";
import { detectLangFaqFuzzy } from "./faq-fuzzy-detect.js";
import { initFaqData } from "./faq-data.js";
import { logMessage } from "./logger.js";
import { getFaqCache } from "./faq-cache.js";

let faqReady = false;

// Confidence map
function mapConfidence(via, lang) {
  switch (via) {
    case "regex-exclusive": return 1.0;
    case "heuristic+anchors": return 0.8;
    case "heuristic": return 0.6;
    default: return lang === "UNKNOWN" ? 0.0 : 0.5;
  }
}

// Grammar patterns
const grammarPatterns = {
  SE: [/det stora huset/, /ni /, /har kommit/],
  DA: [/det store hus/, / i /, /er kommet/],
  DE: [/der |die |das |den |dem |des |ein |eine |bin |bist |ist |sind |seid /],
  EN: [
    /\b(do|does|did)\b/,
    /\b(am|is|are|was|were)\s+\w+ing\b/,
    /\bgoing to\s+\w+\b/,
    /\bwill\s+\w+\b/,
  ],
};

// Cluster detection
function getClusterLabel(scores) {
  const { SE = 0, DA = 0, DE = 0, EN = 0 } = scores;
  if (SE > 0 && DA > 0 && Math.abs(SE - DA) <= 2 && DE <= 1 && SE + DA > EN) {
    return "SCANDI";
  }
  const germCount = [SE, DA, DE].filter((v) => v > 1).length;
  if (germCount >= 2 && SE + DA + DE > EN) {
    return "GERMANIC";
  }
  return null;
}

// Main
export async function detectLangCore(input, opts = {}) {
  const { skipAI = false, ipCountryCode = null } = opts;
  const clean = input.trim();

  // 🌍 IP-based lang detection (väger tungt i produktion)
if (ipCountryCode) {
  switch (ipCountryCode.toUpperCase()) {
    case "SE": return { lang: "SE", via: "ip-geo", confidence: 0.95 };
    case "DK": return { lang: "DA", via: "ip-geo", confidence: 0.95 };
    case "DE": return { lang: "DE", via: "ip-geo", confidence: 0.95 };
    case "GB":
    case "US":
    case "EN": return { lang: "EN", via: "ip-geo", confidence: 0.95 };
  }
}

  // 🔑 Initiera FAQ-data en gång
  if (!faqReady) {
    try {
      await initFaqData("detectLangCore");
      faqReady = true;
    } catch (err) {
      logMessage("detect-lang.log", `⚠️ Kunde inte init FAQ-data: ${err.message}`);
    }
  }

  // 1️⃣ Gates
  const isTooShort = clean.length <= 1;
  const isGibberish = /^[\W\d]+$/.test(clean);
  if (isTooShort || isGibberish) {
    logMessage("detect-lang.log", `🚫 Input blockerat (kort/gibberish): "${input}"`);
    return { lang: "UNKNOWN", via: "rules-fallback", confidence: 0.5, NeedsAI: false };
  }

  // 2️⃣ FAQ fuzzy detect
  const faqRes = detectLangFaqFuzzy(clean);
  if (faqRes) {
    logMessage("detect-lang.log", `✅ FAQ fuzzy detect: "${input}" → ${faqRes.lang}`);
    return { ...faqRes, confidence: 1.0, NeedsAI: false };
  }

// 2.5️⃣ FULL_LOOKUP keywords (hög prio efter fuzzy)
try {
  const cache = getFaqCache();
  const lookup = cache?.LOOKUP || {};
  const lower = clean.toLowerCase();

  for (const lang of ["SE", "EN", "DA", "DE"]) {
    const list = lookup[lang] || [];
    if (list.some(kw => lower.includes(kw))) {
      logMessage("detect-lang.log", `🔑 FULL_LOOKUP träff: "${input}" → ${lang}`);
      return { lang, via: "full-lookup", confidence: 1.0, NeedsAI: false };
    }
  }
} catch (err) {
  logMessage("detect-lang.log", `⚠️ FULL_LOOKUP misslyckades: ${err.message}`);
}

  
  // 3️⃣ Rules
  let rulesRes = await detectLangRulesOnly(clean);
  let confidence = mapConfidence(rulesRes.via, rulesRes.lang);
  logMessage("detect-lang.log", `ℹ️ Rules resultat: ${JSON.stringify(rulesRes)} (conf=${confidence})`);

  // 4️⃣ Grammar & IP scoring
  const scores = { SE: 0, DA: 0, DE: 0, EN: 0 };
  for (const [lang, patterns] of Object.entries(grammarPatterns)) {
    for (const p of patterns) {
      if (p.test(clean.toLowerCase())) scores[lang] += 2;
    }
  }

  if (ipCountryCode) {
    let ipWeight = clean.length < 50 ? 20 : clean.length < 200 ? 10 : 5;
    switch (ipCountryCode.toUpperCase()) {
      case "SE": scores.SE += ipWeight; break;
      case "DK": scores.DA += ipWeight; break;
      case "DE": scores.DE += ipWeight; break;
      case "GB":
      case "US":
      case "AU":
      case "CA": scores.EN += ipWeight; break;
    }
    logMessage("detect-lang.log", `🌍 IP-viktning (${ipCountryCode}): ${JSON.stringify(scores)}`);
  }

  // 5️⃣ Cluster eller grammar-override
  if (!rulesRes.via.includes("regex")) {
    const cluster = getClusterLabel(scores);

    if (cluster) {
      logMessage("detect-lang.log", `🔀 Cluster override: ${cluster}`);
      return {
        ...rulesRes,
        lang: cluster,
        via: rulesRes.via + "+cluster",
        confidence: confidence * 0.8,
        NeedsAI: true,
        scores,
      };
    }

    for (const [lang, val] of Object.entries(scores)) {
      if (val >= 5 && lang !== rulesRes.lang) {
        logMessage("detect-lang.log", `✍️ Grammar override: ${rulesRes.lang} → ${lang}`);
        return {
          ...rulesRes,
          lang,
          via: rulesRes.via + "+grammar",
          confidence: 0.9,
          NeedsAI: false,
          scores,
        };
      }
    }

    if (rulesRes.lang === "UNKNOWN" && ipCountryCode) {
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
        logMessage("detect-lang.log", `🌐 IP fallback: ${ipCountryCode} → ${ipLang}`);
        return {
          ...rulesRes,
          lang: ipLang,
          via: "ip-fallback",
          confidence: 0.9,
          NeedsAI: false,
          scores,
        };
      }
    }
  }

  // 6️⃣ AI fallback
  if (rulesRes.NeedsAI && !skipAI) {
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
          via: "AI-fallback",
          confidence: 0.9,
          NeedsAI: false,
          matches: rulesRes.matches || [],
          scores,
        };
      }
    } catch (err) {
      logMessage("detect-lang.log", `⚠️ AI fallback failed: ${err.message}`);
    }
  }

  // 7️⃣ Default return
  logMessage("detect-lang.log", `⬅️ Default return: lang=${rulesRes.lang}, conf=${confidence}`);
  return {
    ...rulesRes,
    confidence,
    NeedsAI: !skipAI && confidence < 0.7,
    scores,
  };
}
