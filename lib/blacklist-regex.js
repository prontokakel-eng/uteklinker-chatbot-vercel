/**
 * [DEPRECATED STUB] blacklist-regex.js
 * Tom stub för bakåtkompatibilitet under städning (FAS3).
 * - default export: tom mönsterlista
 * - named export: blacklistRegexMatch(text, patterns?) -> { matched: boolean, pattern?: string }
 */

const BLACKLIST_PATTERNS = []; // behåll tom under FAS3

export function blacklistRegexMatch(text = "", patterns = BLACKLIST_PATTERNS) {
  const s = String(text || "");
  for (const p of patterns) {
    try {
      const rx = p instanceof RegExp ? p : new RegExp(p, "i");
      if (rx.test(s)) return { matched: true, pattern: String(p) };
    } catch {
      // Ignorera trasiga patterns i deprecated-läge
    }
  }
  return { matched: false };
}

export default BLACKLIST_PATTERNS;
