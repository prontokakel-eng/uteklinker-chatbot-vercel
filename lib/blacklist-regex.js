/**
 * [DEPRECATED STUB] blacklist-regex.js
 * Kompatibel API-yta för smoke-test:
 *  - default export: tom mönsterlista
 *  - named export: blacklistRegexMatch(text, patterns?) -> { matched: boolean, pattern?: string }
 * Klarar string | RegExp | Array<string|RegExp>
 */

import { normalizeText } from "./text-normalize.js";

const BLACKLIST_PATTERNS = []; // Behåll tom under FAS3

function toArray(patterns) {
  if (patterns == null) return BLACKLIST_PATTERNS;
  return Array.isArray(patterns) ? patterns : [patterns];
}

export function blacklistRegexMatch(text = "", patterns) {
  const s = normalizeText(String(text || ""));
  const list = toArray(patterns);

  for (const p of list) {
    let rx;
    try {
      rx = p instanceof RegExp ? p : new RegExp(String(p), "i");
    } catch {
      // Ignorera ogiltiga mönster i deprecated-läge
      continue;
    }
    if (rx.test(s)) return { matched: true, pattern: String(p) };
  }
  return { matched: false };
}

export default BLACKLIST_PATTERNS;
