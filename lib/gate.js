import { detectShortLangWord, checkGreeting, runFilters } from "./filters.js";
import { logMessage } from "./logger.js";
import { detectLangCore } from "./detect-lang-core.js";
import { getIpLang } from "./ip-lang.js";
import { checkRateLimit } from "./rate-limiter.js";
import { applyWhitelist, applyBlacklist } from "./wl-bl-filters.js";
import { checkGibberish } from "./gibberish-filter.js";

// Välj kandidat-språk tidigt: kortord → IP → ALL
function pickCandidateLang(message, ip) {
  const shortLang = detectShortLangWord(message);
  if (shortLang?.handled && shortLang.lang) return shortLang.lang;

  const ipLang = getIpLang(ip);
  if (ipLang && ipLang !== "UNKNOWN") return ipLang;

  return "ALL";
}

export async function gateMessage(message, ip) {
  const norm = message?.trim() || "";
  if (!norm) return { filtered: true, reason: "Empty input" };
  if (norm.length < 1) return { filtered: true, reason: "Too short" };
  if (norm.length > 2000) return { filtered: true, reason: "Too long" };

  const candidateLang = pickCandidateLang(norm, ip);

  // 1) Whitelist (ALL/IP/kortord) – släpper igenom säkra format/domänord
  const wl = applyWhitelist(norm, { lang: candidateLang });
  if (wl?.handled) {
    return { filtered: false, reason: wl.reason, via: "whitelist", lang: candidateLang };
  }

  // 2) Blacklist – blocka tidigt
  const bl = applyBlacklist(norm, { lang: candidateLang });
  if (bl?.handled) return { filtered: true, reason: bl.reason, via: "blacklist" };

  // 3) Gibberish – stoppa meningslöst
  const gibber = checkGibberish(norm);
  if (gibber?.handled) {
    logMessage("gate.log", `Gibberish: ${norm}`);
    return { filtered: true, reason: gibber.reason, via: gibber.via };
  }

  // 3.5) Rate limit TIDIGT (före ev. dyra steg)
  {
    const rate = await checkRateLimit(ip);
    if (rate?.limited) {
      logMessage("gate.log", `Rate limit IP=${ip}`);
      return { filtered: true, reason: rate.reason, via: rate.via };
    }
  }

  // 🧩 NYTT: Centrala filterpunkter (4–6 enligt Gate-kontraktet)
  const filterRes = runFilters(norm, candidateLang);
  if (filterRes.handled) {
    logMessage("gate.log", `Filter handled (${filterRes.type}): ${filterRes.reply}`);
    return {
      filtered: true,
      reason: filterRes.type,
      via: "filters",
      lang: candidateLang,
      reply: filterRes.reply,
    };
  }

  // 🧩 NYTT: Logga när alla filter passerats
  logMessage("gate.log", `[Gate] All filters passed → proceeding to detectLangCore`);

  // 7) Språkdetekt med IP‐hint (icke-blockerande) — fail-safe
  const ipLang = getIpLang(ip);
  if (ip) logMessage("gate.log", `IP hint: ${ip} -> ${ipLang}`);

  let langRes = { lang: "UNKNOWN", via: "lang-detector" };
  try {
    langRes = await detectLangCore(message, { skipAI: true, ipCountryCode: ipLang });
  } catch (e) {
    logMessage("gate.log", `detectLangCore error: ${e?.message || e}`);
  }

  if (langRes?.lang === "UNKNOWN") {
    // Sista spärren: kör rate limit en gång till innan vi släpper igenom
    const rate2 = await checkRateLimit(ip);
    if (rate2?.limited) {
      logMessage("gate.log", `Rate limit IP=${ip} (late)`);
      return { filtered: true, reason: rate2.reason, via: rate2.via };
    }
    logMessage("gate.log", `Språk oklart (${message})`);
    return { filtered: false, reason: "Osäkert språk", via: langRes.via };
  }

  // 8) Släpp igenom med språk
  logMessage("gate.log", `Gate pass: ${langRes.lang} (${message})`);

  // 🧩 NYTT: Sanity-logg efter slutförd gate
  logMessage("gate.log", `✅ Gate completed → downstream chat/FAQ`);

  return { filtered: false, reason: "OK", via: langRes.via, lang: langRes.lang };
}
