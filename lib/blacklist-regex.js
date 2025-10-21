/**
 * [DEPRECATED STUB] blacklist-regex.js
 * Kompatibel API-yta för smoke-test.
 */

import { normalizeText } from "./text-normalize.js";

const BLACKLIST_PATTERNS = []; // håll tomt under FAS3

function toArray(patterns) {
  if (patterns == null) return BLACKLIST_PATTERNS;
  return Array.isArray(patterns) ? patterns : [patterns];
}

function parsePattern(p) {
  if (p instanceof RegExp) return p;
  const s = String(p ?? "").trim();

  // Stöd för "/.../flags"-syntax (t.ex. "/bad\\s*word/gi")
  const m = /^\/(.+)\/([gimsuy]*)$/.exec(s);
  if (m) {
    const [, body, flags] = m;
    try {
      return new RegExp(body, flags || "i");
    } catch {
      // fall-through till rå sträng
    }
  }
  // Rå sträng ⇒ defaulta till case-insensitive
  try {
    return new RegExp(s, "i");
  } catch {
    return null; // ignoreras av callsite
  }
}

export function blacklistRegexMatch(text = "", patterns) {
  const s = normalizeText(String(text || ""));
  const list = toArray(patterns);

  for (const p of list) {
    const rx = parsePattern(p);
    if (!rx) continue;
    if (rx.test(s)) return { matched: true, pattern: String(p) };
  }
  return { matched: false };
}

export default BLACKLIST_PATTERNS;
