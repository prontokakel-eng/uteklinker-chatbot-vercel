import { detectShortLangWord } from "./filters.js";
import { logMessage } from "./logger.js";
import { checkGreeting } from "./filters.js";
import { detectLangCore } from "./detect-lang-core.js";
import { getIpLang } from "./ip-lang.js";
import { checkRateLimit } from "./rate-limiter.js";
import { applyWhitelist, applyBlacklist } from "./wl-bl-filters.js";
import { checkGibberish } from "./gibberish-filter.js";

export async function gateMessage(message, ip) {
  const norm = message?.trim() || "";
  if (!norm) return { filtered: true, reason: "Empty input" };

  if (norm.length < 1) return { filtered: true, reason: "Too short" };
  if (norm.length > 2000) return { filtered: true, reason: "Too long" };

  const wl = applyWhitelist(norm);
  if (wl?.handled) return { filtered: false, reason: wl.reason, via: "whitelist" };

  const bl = applyBlacklist(norm);
  if (bl?.handled) return { filtered: true, reason: bl.reason, via: "blacklist" };

  const gibber = checkGibberish(norm);
  if (gibber?.handled) {
    logMessage("gate.log", `Gibberish: ${norm}`);
    return { filtered: true, reason: gibber.reason, via: gibber.via };
  }

  const shortLang = detectShortLangWord(message);
  if (shortLang?.handled) {
    logMessage("gate.log", `Shortword: ${shortLang.lang} (${message})`);
    return {
      filtered: false,
      reason: `Kortord identifierat (${shortLang.lang})`,
      via: shortLang.via,
      lang: shortLang.lang,
      confidence: shortLang.confidence ?? 0.9,
      handled: true,
    };
  }

  const greet = checkGreeting(message, "SE");
  if (greet?.handled) {
    logMessage("gate.log", `Greeting: ${message}`);
    return { filtered: false, reason: "Greeting detected", via: "greeting-filter" };
  }

  const ipLang = getIpLang(ip);
  const langRes = await detectLangCore(message, { skipAI: true, ipCountryCode: ipLang });

  if (langRes?.lang === "UNKNOWN") {
    logMessage("gate.log", `Språk oklart (${message})`);
    return { filtered: false, reason: "Osäkert språk", via: langRes.via };
  }

  const rate = await checkRateLimit(ip);
  if (rate?.limited) {
    logMessage("gate.log", `Rate limit IP=${ip}`);
    return { filtered: true, reason: rate.reason, via: rate.via };
  }

  logMessage("gate.log", `Gate pass: ${langRes.lang} (${message})`);
  return { filtered: false, reason: "OK", via: langRes.via, lang: langRes.lang };
}
