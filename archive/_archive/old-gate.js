import { normalizeMessage } from "./utils-text.js";
import { containsWhitelistWord, containsBlacklistWord, isGibberish, checkGreeting } from "./filters.js"; // 🧩 greeting import
import { checkRateLimit } from "./rate-limiter.js";
import { logMessage } from "./logger.js";

// ------------------------------------------------------------
// 🚪 runGate() — instrumenterad version
// ------------------------------------------------------------
export function runGate(message, ip = "anon") {
  // 🧩 DEBUG: rådata som Gate får in
  try {
    const snippet = String(message || "").slice(0, 120).replace(/\n/g, " ");
    logMessage("gate.debug.log", `[DEBUG-IN] IP=${ip} RAW_LEN=${(message || "").length} RAW_SNIPPET="${snippet}"`);
  } catch (e) {
    console.warn("Gate debug log failed at input stage:", e);
  }

  // 🧩 1️⃣ Längdkontroll – innan normalisering
  const rawLen = (message || "").length;
  const MAX_LEN = 400;
  if (rawLen > MAX_LEN) {
    logMessage("gate.log", `✂️ Block long text IP=${ip} len=${rawLen}`);
    logMessage("gate.debug.log", `[DEBUG-LONG] Blocked len=${rawLen}`);
    return {
      filtered: true,
      reason: `🚫 För lång fråga (${rawLen} tecken)`,
      via: "long-text",
    };
  }

  // 🧩 2️⃣ Behåll original för blacklist-matchning
  const rawMsg = (message || "").toLowerCase().replace(/\s+/g, " ").trim();

  // 🧩 DEBUG: logga normaliserad råtext
  try {
    const snippet = rawMsg.slice(0, 150);
    logMessage("gate.debug.log", `[DEBUG-BL] IP=${ip} RAWMSG_SNIPPET="${snippet}"`);
  } catch (e) {
    console.warn("Gate debug log failed at rawMsg stage:", e);
  }

  // 🔒 Global blacklist (ALL)
  if (containsBlacklistWord(rawMsg, "ALL")) {
    logMessage("gate.log", `🔒 Blacklist (ALL) IP=${ip} msg="${message}"`);
    logMessage("gate.debug.log", `[DEBUG-BLOCK] type=blacklist-ALL IP=${ip}`);
    return {
      filtered: true,
      reason: "🚫 Din fråga innehåller blockerade ord.",
      via: "blacklist-ALL",
    };
  }

  // 🔒 Språk-specifik blacklist
  for (const lang of ["SE", "EN", "DA", "DE"]) {
    if (containsBlacklistWord(rawMsg, lang)) {
      logMessage("gate.log", `🔒 Blacklist (${lang}) IP=${ip} msg="${message}"`);
      logMessage("gate.debug.log", `[DEBUG-BLOCK] type=blacklist-${lang} IP=${ip}`);
      return {
        filtered: true,
        reason: `🚫 Din fråga innehåller blockerade ord [${lang}]`,
        via: `blacklist-${lang}`,
      };
    }
  }

  // 🔤 Normalisera efteråt (för whitelist/gibberish)
  const norm = normalizeMessage(message);

  // ✅ Whitelist – override
  if (containsWhitelistWord(norm, "ALL")) {
    logMessage("gate.log", `✅ Whitelist override IP=${ip}`);
    return { filtered: false, reason: "✅ Whitelist override", via: "whitelist-ALL" };
  }

  // ✅ Språk-specifik whitelist
  for (const lang of ["SE", "EN", "DA", "DE"]) {
    if (containsWhitelistWord(norm, lang)) {
      logMessage("gate.log", `✅ Whitelist override [${lang}] IP=${ip}`);
      return { filtered: false, reason: `✅ Whitelist override [${lang}]`, via: `whitelist-${lang}` };
    }
  }

  // 🤪 Gibberish
  if (isGibberish(norm)) {
    logMessage("gate.log", `🤪 Gibberish IP=${ip} msg="${message}"`);
    logMessage("gate.debug.log", `[DEBUG-BLOCK] type=gibberish IP=${ip}`);
    return { filtered: true, reason: "🚫 Din fråga ser ut som gibberish.", via: "gibberish" };
  }

  // 👋 Kort text – tillåt greetings
  const greet = checkGreeting(message, "SE");
  if (norm.length < 2 && !greet?.handled) {
    logMessage("gate.log", `📏 Kort text IP=${ip} msg="${message}"`);
    logMessage("gate.debug.log", `[DEBUG-BLOCK] type=short-text IP=${ip}`);
    return { filtered: true, reason: "🚫 För kort fråga.", via: "short-text" };
  }

  // ⏱️ Rate-limit
  const rl = checkRateLimit(ip);
  if (rl.limited) {
    logMessage("gate.log", `⏱️ Rate-limit triggad IP=${ip} → ${rl.reason}`);
    logMessage("gate.debug.log", `[DEBUG-BLOCK] type=rate-limit IP=${ip}`);
    return {
      filtered: true,
      reason: rl.reason,
      via: rl.type ? `rate-limit-${rl.type}` : "rate-limit",
    };
  }

  // ✅ Godkänd
  logMessage("gate.debug.log", `[PASS] IP=${ip} via=pass`);
  return { filtered: false, reason: "OK", via: "pass" };
}
