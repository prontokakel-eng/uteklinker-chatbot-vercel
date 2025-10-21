/**
 * text-normalize.js
 * Robust men ofarlig normalisering:
 * - lowercasa
 * - NFKD + ta bort diakritik
 * - ta bort icke-bokstavliga tecken (behåll siffror/bokstäver/blanksteg)
 * - trimma och kollapsa whitespace
 */
export function stripDiacritics(s) {
  return String(s || "").normalize("NFKD").replace(/\p{M}+/gu, "");
}

export function normalizeText(s = "") {
  return stripDiacritics(String(s))
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default { normalizeText, stripDiacritics };
