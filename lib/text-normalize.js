// /lib/text-normalize.js
// ESM. Enkel, stabil normalisering (NFKC + komprimerade whitespaces).
export function normalizeText(s) {
  if (typeof s !== "string") return "";
  return s.normalize("NFKC").replace(/\s+/g, " ").trim();
}
