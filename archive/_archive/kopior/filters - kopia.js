// 🧩 /lib/filters.js
// Central filtermodul – innehåller kortord, greeting, och hjälpfunktioner

import { logMessage } from "./logger.js";

// 🧩 Kortord-detektion (existerar redan i Gate)
export function detectShortLangWord(text = "") {
  const t = text.trim().toLowerCase();
  const shortLex = {
    SE: ["ja", "nej", "hej", "tack"],
    DA: ["ja", "nej", "tak", "hej"],
    DE: ["ja", "nein", "danke", "hallo"],
    EN: ["hi", "ok", "no", "yes", "hey"],
  };

  for (const [lang, list] of Object.entries(shortLex)) {
    if (list.includes(t)) {
      return { handled: true, lang, via: "shortword-filter", confidence: 0.9 };
    }
  }
  return { handled: false };
}

// 🧩 checkGreeting – fångar hälsningar på SE / DA / DE / EN
export function checkGreeting(text = "", defaultLang = "SE") {
  if (!text || typeof text !== "string") return { handled: false };

  const t = text.trim().toLowerCase();

  const greetings = {
    SE: ["hej", "god morgon", "god kväll", "hallå", "tjena", "mors"],
    DA: ["hej", "godmorgen", "goddag", "halløj"],
    DE: ["hallo", "guten tag", "guten morgen", "servus"],
    EN: ["hi", "hello", "hey", "good morning", "good evening", "yo"],
  };

  const hit = Object.values(greetings).some((arr) => arr.some((g) => t.startsWith(g)));

  if (hit) {
    logMessage("filters.log", `👋 Greeting detected: ${text}`);
    return { handled: true, reason: "greeting detected", via: "greeting-filter" };
  }

  return { handled: false };
}
