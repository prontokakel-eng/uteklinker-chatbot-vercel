// /lib/blacklist-regex.js
// ESM. Produktionsredo hjälpare för regex-baserad BLACKLIST-matchning.
// - Läser mönster från /config/blacklist-patterns.json
// - Normaliserar text via /lib/text-normalize.js
// - Prekompilerar RegExp-mönster vid modul-load för prestanda
//
// OBS: Ändra inte gate-ordningen här. Denna modul gör EN sak: regex-matchning.
// Din gate-orchestration (wl-bl-filters) kallar denna efter WL och ordlista-BL.
//
// © ChatBot project

import { normalizeText } from "./text-normalize.js"; // fileciteturn2file0

// Node ESM: importera JSON med assertions (Node 18+/Vercel ok)
import patterns from "../config/blacklist-patterns.json" with { type: "json" };

/**
 * Kompilera mönster -> RegExp
 * @param {{name:string, pattern:string, flags?:string}[]} items
 * @returns {{name:string, rx:RegExp}[]}
 */
function compilePatterns(items) {
  return items
    .filter(p => typeof p?.pattern === "string" && p.pattern.length > 0)
    .map(p => ({
      name: p.name || p.pattern.slice(0, 32),
      rx: new RegExp(p.pattern, p.flags || "i"),
    }));
}

// Precompile
const COMPILED = compilePatterns(patterns);

/**
 * Kör regex-blacklist mot text.
 * Viktigt: vi förutsätter att WL/ordlist-BL redan körts uppströms.
 *
 * @param {string} rawText
 * @returns {{ hit: boolean, which: string[], details: {name:string, index:number}[] }}
 */
export function blacklistRegexMatch(rawText) {
  const norm = normalizeText(rawText || "");
  if (!norm) return { hit: false, which: [], details: [] };

  const which = [];
  const details = [];

  for (let i = 0; i < COMPILED.length; i++) {
    const { name, rx } = COMPILED[i];
    if (rx.test(norm)) {
      which.push(name);
      details.push({ name, index: i });
    }
  }

  return { hit: which.length > 0, which, details };
}

/**
 * Utility: returnera true/false direkt, om du bara bryr dig om blockning.
 * @param {string} rawText
 * @returns {boolean}
 */
export function isBlacklistedByRegex(rawText) {
  return blacklistRegexMatch(rawText).hit;
}