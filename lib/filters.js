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

// 🧩 runFilters – centralt filter-anrop (punkt 4–6 i Gate-kontraktet)
export function runFilters(input, defaultLang = "SE") {
  const text = (input || "").trim();
  if (!text) return { handled: false };

  // 1️⃣ Kortord (ja/nej/hej/tack m.m.)
  const shortRes = detectShortLangWord(text);
  if (shortRes.handled) {
    logMessage("filters.log", `✅ Kortord hanterat (${text})`);
    const replies = {
      SE: shortRes.reply || text,
      DA: shortRes.reply || text,
      DE: shortRes.reply || text,
      EN: shortRes.reply || text,
    };
    return { handled: true, type: "shortword", reply: replies[defaultLang] };
  }

  // 2️⃣ Hälsning (hej/hello m.m.)
  const greetRes = checkGreeting(text, defaultLang);
  if (greetRes.handled) {
    const replies = {
      SE: "Hej!",
      DA: "Hej!",
      DE: "Hallo!",
      EN: "Hello!",
    };
    logMessage("filters.log", `👋 Hälsning hanterad (${text})`);
    return { handled: true, type: "greeting", reply: replies[defaultLang] };
  }

  // 3️⃣ För kort eller nonsens
  if (text.length < 3 || /^(en|sa|ok|no|yo)$/i.test(text)) {
    logMessage("filters.log", `⚠️ Otydlig eller för kort input: \"${text}\"`);
    const replies = {
      SE: "Vänligen skriv en mer specifik fråga så jag kan hjälpa dig.",
      DA: "Venligst skriv et mere specifikt spørgsmål, så jeg kan hjælpe dig.",
      DE: "Bitte formulieren Sie Ihre Frage genauer, damit ich Ihnen helfen kann.",
      EN: "Please write a more specific question so I can assist you.",
    };
    return { handled: true, type: "invalid", reply: replies[defaultLang] };
  }

  // 4️⃣ Annars passera vidare
  return { handled: false };
}