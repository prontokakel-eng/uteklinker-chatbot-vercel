import path from "path";
import { fileURLToPath } from "url";
import stringSimilarity from "string-similarity";
import { normalizeMessage } from "./utils-text.js";
import wordLists from "../config/BL-WL-words-list.json" with { type: "json" };

// ESM-safe __dirname (om du vill använda vid behov)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ------------------------------------------------------------
// 🧩 Bygg WL/BL-listor
// ------------------------------------------------------------
function buildList(type, lang = "ALL") {
  const section = wordLists[type] || {};
  const merged = [
    ...(section.ALL || []),
    ...(lang && lang !== "ALL" ? section[lang] || [] : []),
  ];
  return merged
    .map((s) => String(s).toLowerCase())
    .filter(Boolean);
}

// ------------------------------------------------------------
// ✂️ Längdkontroll
// ------------------------------------------------------------
const MAX_LEN = 400; // cutoff för för långa frågor

export function checkLength(input) {
  if (!input || typeof input !== "string") return null;
  if (input.length > MAX_LEN) {
    return {
      blocked: true,
      reason: "long-text",
      reply: "Din fråga är för lång. Försök formulera den kortare.",
    };
  }
  return null;
}

// ------------------------------------------------------------
// 👋 Hälsningar (greetings)
// ------------------------------------------------------------
export const greetings = {
  SE: ["hej", "hejhej", "tjena", "godmorgon", "god kväll", "godmiddag", "god eftermiddag"],
  EN: ["hi", "hello", "hey", "good morning", "good evening", "good afternoon"],
  DA: ["hej", "hejhej", "godmorgen", "godaften", "goddag"],
  DE: ["hallo", "hi", "guten morgen", "guten abend", "guten tag"],
};

const greetingReplies = {
  SE: "Hej! Hur kan jag hjälpa dig?",
  EN: "Hello! How can I help you?",
  DA: "Hej! Hvordan kan jeg hjælpe dig?",
  DE: "Hallo! Wie kann ich Ihnen helfen?",
};

// Greetingdetektion
export function checkGreeting(input, detectedLang = "SE") {
  const txt = (input || "").trim().toLowerCase();

  // Försök först på detekterat språk
  const langList = greetings[detectedLang] || [];
  if (langList.some((g) => txt.startsWith(g))) {
    return { handled: true, reply: greetingReplies[detectedLang] };
  }

  // Annars försök i alla språk
  for (const [lang, list] of Object.entries(greetings)) {
    if (list.some((g) => txt.startsWith(g))) {
      return { handled: true, reply: greetingReplies[lang] };
    }
  }

  return { handled: false };
}

// ------------------------------------------------------------
// 🧠 Relevansfilter
// ------------------------------------------------------------
export function checkRelevance(input, detectedLang = "SE") {
  const txt = (input || "").trim().toLowerCase();

  // triviala heuristiker för irrelevant
  if (txt.length < 3 || /^[\d\W]+$/.test(txt)) {
    return {
      handled: true,
      reply: {
        SE: "Din fråga verkar inte vara relaterad till våra produkter. Vänligen omformulera frågan.",
        EN: "Your question doesn’t seem to relate to our products. Please rephrase your question.",
        DA: "Dit spørgsmål ser ikke ud til at være relateret til vores produkter. Venligst omformuler spørgsmålet.",
        DE: "Ihre Frage scheint nicht mit unseren Produkten zusammenzuhängen. Bitte formulieren Sie die Frage um.",
      }[detectedLang] ||
        "Din fråga verkar inte vara relaterad till våra produkter. Vänligen omformulera frågan.",
    };
  }
  return { handled: false };
}

// ------------------------------------------------------------
// ✅ Whitelist (fuzzy + exact)
// ------------------------------------------------------------
export function containsWhitelistWord(message, lang = "SE", threshold = 0.8) {
  if (!message || typeof message !== "string") return false;
  const msg = normalizeMessage(message);
  const words = msg.split(/\s+/);
  const list = buildList("WHITELIST", lang);
  if (!list.length) return false;

  // exact
  for (const word of list) {
    if (msg.includes(word)) {
      console.log(`✅ WL exact match [${lang}]`, { word, message });
      return true;
    }
  }

  // fuzzy
  try {
    for (const word of words) {
      if (word.length < 3) continue;
      const matches = stringSimilarity.findBestMatch(word, list);
      if (matches.bestMatch.rating >= threshold) {
        console.log(`✅ WL fuzzy match [${lang}]`, { word, match: matches.bestMatch, message });
        return true;
      }
    }
  } catch (e) {
    console.error("⚠️ containsWhitelistWord fuzzy check failed:", e);
    return false;
  }
  return false;
}

// ...[allt oförändrat ovanför]...

// ------------------------------------------------------------
// 🔒 Blacklist (regex + fuzzy, förbättrad whitespace-hantering + DEBUG)
// ------------------------------------------------------------
export function containsBlacklistWord(message, lang = "ALL", threshold = 0.95) {
  if (!message || typeof message !== "string") return false;

  const msg = (message || "").toLowerCase().replace(/\s+/g, " ").trim();
  const words = msg.split(/\s+/).filter(Boolean);
  const list = buildList("BLACKLIST", lang);

  // 🟡 DEBUG: lista-info och sample
  if (!list.length) {
    console.warn(`🔍 BL DEBUG: buildList("BLACKLIST", ${lang}) returned 0 items. message="${message.slice(0, 100)}..."`);
    return false;
  } else {
    const sample = list.slice(0, 8);
    console.log(`🔍 BL DEBUG: list.length=${list.length}, sample=${JSON.stringify(sample)}`);
  }

  // === Exact match ===
  for (const bad of list) {
    const re = new RegExp(escapeRegex(bad), "i");
    const matched = re.test(msg);
    if (matched) {
      console.log(`🔒 BL exact match [${lang}]`, { bad, message: message.slice(0, 120) });
      return true;
    }
    // logga slumpmässigt ett par missar
    if (Math.random() < 0.02) {
      console.debug(`🔍 BL miss [${lang}] bad="${bad}" msg="${msg.slice(0, 80)}"`);
    }
  }

  // === Fuzzy match ===
  try {
    for (const word of words) {
      if (word.length < 3) continue;
      const matches = stringSimilarity.findBestMatch(word, list);
      const best = matches.bestMatch;
      if (best.rating >= threshold && best.target.length >= 3) {
        console.log(`🔒 BL fuzzy match [${lang}]`, { word, match: best, message: message.slice(0, 120) });
        return true;
      }
    }
  } catch (e) {
    console.error("⚠️ containsBlacklistWord fuzzy failed:", e);
    return false;
  }

  console.debug(`🔍 BL DEBUG: no matches for message="${message.slice(0, 120)}" (lang=${lang})`);
  return false;
}

// ...[resten av filen, inkl. checkBlacklist och isGibberish, oförändrad]...



// ------------------------------------------------------------
// 🚫 Blacklist wrapper (exporteras)
// ------------------------------------------------------------
export function checkBlacklist(input, lang = "ALL") {
  if (!input || typeof input !== "string") return null;

  // 🧩 Behåll whitespace för regex-matchning
  const msg = (input || "").toLowerCase().replace(/\s+/g, " ").trim();

  // ✅ Global (ALL) först
  if (containsBlacklistWord(msg, "ALL")) {
    console.log(`🔒 Blacklist match (ALL): "${input}"`);
    return {
      blocked: true,
      reason: "blacklist",
      via: "blacklist-ALL",
      reply: "Frågan är inte relevant.",
    };
  }

  // ✅ Språk-specifik
  const langs = ["SE", "EN", "DA", "DE"];
  for (const l of langs) {
    if (containsBlacklistWord(msg, l)) {
      console.log(`🔒 Blacklist match (${l}): "${input}"`);
      return {
        blocked: true,
        reason: "blacklist",
        via: `blacklist-${l}`,
        reply: "Frågan är inte relevant.",
      };
    }
  }

  // ❌ Ingen träff
  return null;
}


// ------------------------------------------------------------
// 🤪 Gibberish (nonsens)
// ------------------------------------------------------------
export function isGibberish(message) {
  const msg = normalizeMessage(message);
  const words = msg.split(/\s+/).filter(Boolean);

  if (words.length < 2 && msg.length > 12) {
    console.log("🤪 Gibberish (långt nonsensord)", { message });
    return true;
  }
  if (words.length > 0 && words.every((w) => w.length > 10)) {
    console.log("🤪 Gibberish (alla jättelånga ord)", { message });
    return true;
  }
  if ((msg.match(/[^a-zåäö]/gi) || []).length / Math.max(1, msg.length) > 0.5) {
    console.log("🤪 Gibberish (>50% icke-bokstäver)", { message });
    return true;
  }
  return false;
}
