// /lib/gate.js
// gate.js — proposed stage order (documentation-only, no code changes)
// Keep logic intact; ensure this order is respected by orchestration.
// 1) candidateLang (detectShortLangWord → getIpLang → fallback ALL)
// 2) whitelist (lang-aware; ALL contains numeric/format only)
// 3) blacklist
// 4) gibberish
// 5) shortWord quick return
// 6) greeting pass (SE default)
// 7) detectLangCore (+IP hint; regexAnchors→heuristics→SE-fallback→group→IP→AI)
// 8) rateLimit
//
// Implementation note:
// - Expose a STAGES enum and assert monotonic execution in tests.
// - Provide feature flag GATE_ORDER_STRICT=true to enforce order in prod logs/tests.

import { detectShortLangWord, checkGreeting } from "./filters.js";
import { logMessage } from "./logger.js";
import { detectLangCore } from "./detect-lang-core.js";
import { getIpLang } from "./ip-lang.js";
import { checkRateLimit } from "./rate-limiter.js";
import { applyWhitelist, applyBlacklist } from "./wl-bl-filters.js";
import { checkGibberish } from "./gibberish-filter.js";


// [ADD] --- Feature flag & step logger (non-invasive) ---

const GATE_ORDER = process.env.GATE_ORDER || "legacy";
const ORDER_STRICT = GATE_ORDER === "strict_2025_10_10";

function stepLogger(file, name, phase, extra = "") {
  try {
    logMessage(file, `gate.step.${phase}=${name}${extra ? " " + extra : ""}`);
  } catch {}
}

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
  stepLogger("gate.log", "whitelist", "start");

  const wl = applyWhitelist(norm, { lang: candidateLang });
  if (wl?.handled) {
    stepLogger("gate.log", "whitelist", "end", "(handled)");
    return { filtered: false, reason: wl.reason, via: "whitelist", lang: candidateLang };
  }

  stepLogger("gate.log", "whitelist", "end");

  // 2) Blacklist – blocka tidigt
  stepLogger("gate.log", "blacklist", "start");

  const bl = applyBlacklist(norm, { lang: candidateLang });
  if (bl?.handled) { stepLogger("gate.log", "blacklist", "end", "(blocked)"); return { filtered: true, reason: bl.reason, via: "blacklist" }; }

  // 3) Gibberish – stoppa meningslöst
  stepLogger("gate.log", "gibberish", "start");

  const gibber = checkGibberish(norm);
  if (gibber?.handled) {
    stepLogger("gate.log", "gibberish", "end", "(blocked)");
    logMessage("gate.log", `Gibberish: ${norm}`);
    return { filtered: true, reason: gibber.reason, via: gibber.via };
  }

  stepLogger("gate.log", "gibberish", "end");

  // 3.5) Rate limit TIDIGT (före ev. dyra steg) — legacy only
  if (!ORDER_STRICT) {
    const rate = await checkRateLimit(ip);
    if (rate?.limited) {
      logMessage("gate.log", `Rate limit IP=${ip}`);
      return { filtered: true, reason: rate.reason, via: rate.via };
    }
  }

  // 4) Kortord – snabb detekt
  stepLogger("gate.log", "shortword", "start");

  const shortLang = detectShortLangWord(message);
  if (shortLang?.handled) {
    stepLogger("gate.log", "shortword", "end", `(handled:${shortLang.lang})`);
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

  stepLogger("gate.log", "shortword", "end");

  // 5) Hälsning (SE default)
  stepLogger("gate.log", "greeting", "start");

  const greet = checkGreeting(message, "SE");
  if (greet?.handled) {
    stepLogger("gate.log", "greeting", "end", "(handled)");
    logMessage("gate.log", `Greeting: ${message}`);
    return { filtered: false, reason: "Greeting detected", via: "greeting-filter" };
  }

  stepLogger("gate.log", "greeting", "end");

  // 6) Språkdetekt med IP‐hint (icke-blockerande) — fail-safe
  stepLogger("gate.log", "detectLangCore", "start");

  const ipLang = getIpLang(ip);
  if (ip) logMessage("gate.log", `IP hint: ${ip} -> ${ipLang}`);

  let langRes = { lang: "UNKNOWN", via: "lang-detector" };
  try {
    langRes = await detectLangCore(message, { skipAI: true, ipCountryCode: ipLang });
  } catch (e) {
    stepLogger("gate.log", "detectLangCore", "end", "(error)");
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

  stepLogger("gate.log", "detectLangCore", "end");

  // 7) Släpp igenom med språk
  logMessage("gate.log", `Gate pass: ${langRes.lang} (${message})`);

  // [ADD] Strict order: Rate limit at the end (after detection)
  if (ORDER_STRICT) {
    const rateFinal = await checkRateLimit(ip);
    if (rateFinal?.limited) {
      logMessage("gate.log", `Rate limit IP=${ip} (final)`);
      return { filtered: true, reason: rateFinal.reason, via: rateFinal.via };
    }
  }

  return { filtered: false, reason: "OK", via: langRes.via, lang: langRes.lang };
}
