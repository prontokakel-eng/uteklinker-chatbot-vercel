// 🧩 /lib/gibberish-filter.js
// Enkel detektor för nonsenstext (gibberish)

import { logMessage } from "./logger.js";

/**
 * checkGibberish(text)
 * Identifierar nonsens eller skräpinput baserat på enkla heuristiker.
 * Returnerar { handled: true, reason, via: "gibberish-filter" } om texten verkar nonsens.
 */
export function checkGibberish(text = "") {
  if (!text || typeof text !== "string") {
    return { handled: true, reason: "Tom eller ogiltig text", via: "gibberish-filter" };
  }

  const t = text.trim();

  // Regel 1: för kort eller för långt
  if (t.length < 2) return { handled: true, reason: "För kort text", via: "gibberish-filter" };
  if (t.length > 1000) return { handled: true, reason: "För lång text", via: "gibberish-filter" };

  // Regel 2: mer än 60% icke-bokstäver
  const letters = t.replace(/[^a-zA-ZåäöÅÄÖæøÆØüßÜẞ]/g, "");
  const ratio = letters.length / t.length;
  if (ratio < 0.4) {
    logMessage("filters.log", `🚫 Gibberish: låg bokstavsanddel (${ratio.toFixed(2)})`);
    return { handled: true, reason: "För få bokstäver", via: "gibberish-filter" };
  }

  // Regel 3: saknar vokaler
  if (!/[aeiouyåäöæøü]/i.test(t)) {
    logMessage("filters.log", "🚫 Gibberish: inga vokaler");
    return { handled: true, reason: "Inga vokaler", via: "gibberish-filter" };
  }

  // Regel 4: upprepade mönster som "asdf", "qwerty"
  if (/asdf|qwer|zxcv|1234|0000|9999|testtest/i.test(t)) {
    return { handled: true, reason: "Repetitivt mönster", via: "gibberish-filter" };
  }

  // Annars OK
  return { handled: false };
}
