// lib/utils-text.js

export function normalizeMessage(message) {
  return String(message || "")
    .toLowerCase()
    .replace(/[.,!?;:()"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function asCheckMark(val) {
  if (val === true) return "✅";
  if (val === false) return "❌";
  return "-";
}
