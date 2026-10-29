// /lib/wl-bl-filters.js
// WL/BL med säker ALL-hantering + "word boundary" för alfabetiska tokens
// + robust storleksnormalisering (600x600 / 600 x 600mm / 60 x 60 cm → 60x60cm)

import { logMessage } from "./logger.js";
import {
  getWhitelistForLang,
  getBlacklistForLang,
  reloadFiltersConfig,
} from "./filters-config.js";

// ==== helpers ==============================================================
const toStr = (v) => (typeof v === "string" ? v : "");

// Talparser (stöd för kommatecken som decimal)
const DEC_SEP = /,/g;
function toNum(s) {
  const n = parseFloat(String(s).replace(DEC_SEP, "."));
  return Number.isFinite(n) ? n : NaN;
}
function stripTrailingZero(dec) {
  return String(dec).replace(/\.0$/, "");
}

/**
 * Normalisera storlekspar i fri text till kanoniskt "AxBcm".
 * Stöd:
 *  - "600x600", "600 x 600", "600×600" (utan enhet) ⇒ om båda >=100 → mm ⇒ /10 → "60x60cm"
 *  - "600x600mm", "600 x 600 mm" ⇒ "60x60cm"
 *  - "60x60", "60 x 60", "60 x 60 cm" ⇒ "60x60cm"
 */
function normalizeSizePairs(input = "") {
  let s = String(input);

  // Fall 1: enhet angiven efter paret (mm|cm)
  s = s.replace(
    /(\d+(?:[.,]\d+)?)\s*[x×✕]\s*(\d+(?:[.,]\d+)?)(?:\s*)(mm|cm)\b/gi,
    (_m, a, b, unit) => {
      const A = toNum(a);
      const B = toNum(b);
      if (!Number.isFinite(A) || !Number.isFinite(B)) return _m;

      const isMm = unit.toLowerCase() === "mm";
      const aCm = isMm ? A / 10 : A;
      const bCm = isMm ? B / 10 : B;

      const aStr = stripTrailingZero(aCm);
      const bStr = stripTrailingZero(bCm);
      return `${aStr}x${bStr}cm`;
    }
  );

  // Fall 2: enhetslöst par – heuristik: båda >=100 ⇒ tolkas som mm
  s = s.replace(
    /(\d+(?:[.,]\d+)?)\s*[x×✕]\s*(\d+(?:[.,]\d+)?)(?!\s*(mm|cm)\b)/gi,
    (_m, a, b) => {
      const A = toNum(a);
      const B = toNum(b);
      if (!Number.isFinite(A) || !Number.isFinite(B)) return _m;

      if (A >= 100 && B >= 100) {
        const aCm = A / 10;
        const bCm = B / 10;
        const aStr = stripTrailingZero(aCm);
        const bStr = stripTrailingZero(bCm);
        return `${aStr}x${bStr}cm`;
      }
      // redan cm (t.ex. 60x60), låt vara
      return _m;
    }
  );

  return s;
}

function normalizeDimensionsToCm(s = "") {
  // 1) Med enhet mm/cm
  s = s.replace(
    /(\d{2,4})\s*[x×✕]\s*(\d{2,4})\s*(mm|cm)\b/gi,
    (_, aRaw, bRaw, unitRaw) => {
      const a = parseInt(aRaw, 10);
      const b = parseInt(bRaw, 10);
      const unit = unitRaw.toLowerCase();
      let A = a, B = b;

      if (unit === "mm") {
        const toCm = (n) => (n % 10 === 0 ? (n / 10).toString() : (n / 10).toFixed(1));
        A = toCm(a);
        B = toCm(b);
      } else {
        A = a.toString();
        B = b.toString();
      }
      return `${A}x${B}cm`;
    }
  );

  // 2) UTAN enhet → anta cm
  s = s.replace(
    /(\d{2,4})\s*[x×✕]\s*(\d{2,4})(?!\s*(?:mm|cm)\b)/gi,
    (_, aRaw, bRaw) => {
      // tolka som cm (600→60 cm om delbart med 10)
      const a = parseInt(aRaw, 10);
      const b = parseInt(bRaw, 10);
      const toCm = (n) => (n >= 100 ? (n % 10 === 0 ? (n / 10).toString() : (n / 10).toFixed(1)) : n.toString());
      const A = toCm(a);
      const B = toCm(b);
      return `${A}x${B}cm`;
    }
  );

  return s;
}

/**
 * Normalisering för jämförelse:
 * - gemener
 * - ×/✕ → x
 * - normalisera storlekspar till AxBcm
 * - " cm" → "cm"
 * - komprimera whitespace
 */
function normalizeForCompare(s = "") {
  const pre = toStr(s).toLowerCase().replace(/[×✕]/g, "x");
  return normalizeSizePairs(pre)
    .replace(/\s*cm\b/g, "cm")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSpaces(s = "") {
  return toStr(s).replace(/\s+/g, "");
}

function ensureArray(a) {
  if (!a) return [];
  if (Array.isArray(a)) return a.filter(Boolean);
  return [a].filter(Boolean);
}

function pickLang(lang) {
  if (!lang || typeof lang !== "string") return "ALL";
  const L = lang.toUpperCase();
  return ["SE", "EN", "DA", "DE", "ALL"].includes(L) ? L : "ALL";
}

function normToken(s = "") {
  return stripSpaces(normalizeForCompare(s));
}

function isAlphabeticToken(s = "") {
  const n = normToken(s);
  // A–Z + latinska diakriter; inga siffror
  if (/\d/.test(n)) return false;
  return /^[a-z\u00c0-\u017f]+$/i.test(n);
}

/**
 * Smart matchning:
 * - alfabetiska tokens → ordgränser (word boundary) i normaliserad sträng
 * - tokens med siffror/format → tolerant substring (även utan mellanslag)
 */
function includesSmart(hay, needle) {
  const H = normalizeForCompare(hay);
  const n = normalizeForCompare(needle);

  if (isAlphabeticToken(needle)) {
    const esc = n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Digits in a tile format must not hide an adjacent blocked word. Unicode
    // letter boundaries still avoid matching inside a longer ordinary word.
    const re = new RegExp(`(?<!\\p{L})${esc}(?!\\p{L})`, "iu");
    return re.test(H);
  } else {
    const H0 = stripSpaces(H);
    const n0 = stripSpaces(n);
    return H.includes(n) || H0.includes(n0);
  }
}

// Värm config-cachen vid import
try { reloadFiltersConfig(); } catch {}

// ==== Public API ===========================================================
export function applyWhitelist(text = "", opts = {}) {
  const t = toStr(text);
  if (!t) return { handled: false };

  const L = pickLang(opts.lang);

  // 1) Språkspecifik WL — men hoppa över när L === 'ALL'
  const langList = L === "ALL" ? [] : ensureArray(getWhitelistForLang(L));
  for (const w of langList) {
    if (!w) continue;
    if (includesSmart(t, w)) {
      logMessage("filters.log", `✅ Whitelist match: ${w} [${L}]`);
      return { handled: true, reason: `whitelisted (${w})`, via: "whitelist" };
    }
  }

  // 2) Global WL med säkerhet:
  //  - L === 'ALL': endast numeriska/format-ord (för att undvika t.ex. 'att', 'detta')
  //  - L konkret: alfabetiska ALL-termer måste finnas i langList
  const globalList = ensureArray(getWhitelistForLang("ALL"));
  const langSet = new Set(langList.map(normToken));

  for (const w of globalList) {
    if (!w) continue;
    const wNorm = normToken(w);
    const hasDigit = /\d/.test(wNorm);

    if (L === "ALL") {
      if (!hasDigit) continue;
    } else {
      if (!hasDigit && !langSet.has(wNorm)) continue;
    }

    if (includesSmart(t, w)) {
      logMessage("filters.log", `✅ Whitelist match: ${w} [${L}]`);
      return { handled: true, reason: `whitelisted (${w})`, via: "whitelist" };
    }
  }

  return { handled: false };
}

export function applyBlacklist(text = "", opts = {}) {
  const t = toStr(text);
  if (!t) return { handled: false };

  const L = pickLang(opts.lang);

  // BL: global gäller alltid; slå ihop med ev. språkspecifik
  const langBL = L === "ALL" ? [] : ensureArray(getBlacklistForLang(L));
  const allBL = ensureArray(getBlacklistForLang("ALL"));
  const list = [...langBL, ...allBL];

  for (const b of list) {
    if (!b) continue;
    if (includesSmart(t, b)) {
      logMessage("filters.log", `🚫 Blacklist match: ${b} [${L}]`);
      return { handled: true, reason: `blacklisted (${b})`, via: "blacklist" };
    }
  }
  return { handled: false };
}
