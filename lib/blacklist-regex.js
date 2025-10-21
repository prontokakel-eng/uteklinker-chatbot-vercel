/**
 * [DEPRECATED STUB] blacklist-regex.js
 * Håller API kompatibelt för smoke: default tom lista + named export blacklistRegexMatch().
 * Robust mot string/RegExp/Array och mot "/.../flags"-strängar.
 * Testar mot både rå och normaliserad text.
 */

import { normalizeText } from "./text-normalize.js";

const BLACKLIST_PATTERNS = []; // medvetet tom under FAS3

function toArray(patterns) {
  if (patterns == null) return BLACKLIST_PATTERNS;
  return Array.isArray(patterns) ? patterns : [patterns];
}

function ensureFlags(flags, mustHave = "i") {
  const set = new Set((flags || "").split(""));
  for (const ch of mustHave) set.add(ch);
  return [...set].join("");
}

function parsePattern(p) {
  if (p instanceof RegExp) return p;
  const s = String(p ?? "").trim();

  // Stöd "/.../flags"
  const m = /^\/(.+)\/([a-z]*)$/.exec(s);
  if (m) {
    const [, body, flags] = m;
    try {
      return new RegExp(body, ensureFlags(flags, "iu"));
    } catch {
      /* fall through */
    }
  }
  // Rå sträng -> case-insensitive + unicode
  try {
    return new RegExp(s, "iu");
  } catch {
    return null;
  }
}

export function blacklistRegexMatch(text = "", patterns) {
  // Testa både rå och normaliserad variant
  const raw = typeof text === "string" ? text : (text && text.text) ? String(text.text) : String(text ?? "");
  const norm = normalizeText(raw);

  const list = toArray(patterns);
  for (const p of list) {
    const rx = parsePattern(p);
    if (!rx) continue;
    if (rx.test(raw) || rx.test(norm)) {
      return { matched: true, pattern: String(p) };
    }
  }
  return { matched: false };
}

export default BLACKLIST_PATTERNS;
