// /lib/filters-config.js
// Läser WL/BL (+ sizes + formats) och NEU från /config med cache och robust parsing.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { logMessage } from "./logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");

function safeReadJson(absPath) {
  try {
    const raw = fs.readFileSync(absPath, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

// robust normalisering till sträng-lista (tar arrays, strängar eller objekt med sträng/arrayvärden)
const normArr = (arr) => {
  let list = [];
  if (!arr) {
    list = [];
  } else if (Array.isArray(arr)) {
    list = arr;
  } else if (typeof arr === "string") {
    list = [arr];
  } else if (typeof arr === "object") {
    list = Object.values(arr).flatMap((v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === "string") return [v];
      return [];
    });
  } else {
    list = [];
  }

  return Array.from(
    new Set(
      list
        .filter(Boolean)
        .map((s) => (typeof s === "string" ? s.trim() : ""))
        .filter(Boolean)
    )
  );
};

function extractByLang(obj = {}) {
  return {
    ALL: normArr(obj.ALL),
    SE: normArr(obj.SE),
    EN: normArr(obj.EN),
    DA: normArr(obj.DA),
    DE: normArr(obj.DE),
  };
}

// Flexibel parser för neutral-words.json
function parseNeutral(obj = {}) {
  if (Array.isArray(obj)) {
    return { ALL: normArr(obj), SE: [], EN: [], DA: [], DE: [] };
  }
  if (obj.NEUTRAL && typeof obj.NEUTRAL === "object") {
    return extractByLang(obj.NEUTRAL);
  }
  return extractByLang(obj);
}

let CACHE = null;

export function getFiltersConfig() {
  if (CACHE) return CACHE;

  // ---- WL/BL ----
  const wlblPath = path.join(repoRoot, "config", "BL-WL-words-list.json");
  const wlbl = safeReadJson(wlblPath);
  const allowlists = extractByLang(wlbl?.WHITELIST || {});
  const blocklists = extractByLang(wlbl?.BLACKLIST || {});

  // ---- sizes -> WL.ALL merge (normaliseringsvarianter för format) ----
  const sizesPath = path.join(repoRoot, "config", "sizes.json");
  const sizesRaw = safeReadJson(sizesPath);
  const sizesList = Array.isArray(sizesRaw) ? sizesRaw : normArr(sizesRaw?.sizes);
  if (sizesList?.length) {
    allowlists.ALL = normArr([...allowlists.ALL, ...sizesList]);
  }

  // ---- formats -> WL.ALL merge (kan vara array ELLER objekt { "60x60": ["60 x 60", ...], ... }) ----
  const formatsPath = path.join(repoRoot, "config", "formats.json");
  const formatsRaw = safeReadJson(formatsPath);
  let formatsList = [];
  if (Array.isArray(formatsRaw)) {
    formatsList = formatsRaw;
  } else if (formatsRaw && typeof formatsRaw === "object") {
    // includera både nyckeln (kanoniskt format) och dess varianter
    formatsList = Object.entries(formatsRaw).flatMap(([k, v]) => {
      const out = [];
      if (typeof k === "string") out.push(k);
      if (Array.isArray(v)) out.push(...v);
      else if (typeof v === "string") out.push(v);
      return out;
    });
  }
  formatsList = normArr(formatsList);
  if (formatsList.length) {
    allowlists.ALL = normArr([...allowlists.ALL, ...formatsList]);
  }

  // ---- NEUTRAL ----
  const neutralPath = path.join(repoRoot, "config", "neutral-words.json");
  const neuRaw = safeReadJson(neutralPath);
  const neutrals = parseNeutral(neuRaw);

  CACHE = { allowlists, blocklists, neutrals };
  logMessage(
    "filters.log",
    `WL loaded: ${Object.values(allowlists).reduce((a, b) => a + b.length, 0)} | ` +
      `BL loaded: ${Object.values(blocklists).reduce((a, b) => a + b.length, 0)} | ` +
      `NEU loaded: ${Object.values(neutrals).reduce((a, b) => a + b.length, 0)}`
  );

  return CACHE;
}

export function reloadFiltersConfig() {
  CACHE = null;
  return getFiltersConfig();
}

function pickLang(lang) {
  if (!lang || typeof lang !== "string") return "ALL";
  const L = lang.toUpperCase();
  return ["SE", "EN", "DA", "DE", "ALL"].includes(L) ? L : "ALL";
}

function mergeAllFirst(listByLang, lang) {
  const L = pickLang(lang);
  const arr = [];
  if (L !== "ALL") arr.push(...(listByLang.ALL || []));
  arr.push(...(listByLang[L] || []));
  return normArr(arr);
}

// ---- Public getters ----
export function getWhitelistForLang(lang = "ALL") {
  const { allowlists } = getFiltersConfig();
  return mergeAllFirst(allowlists, lang);
}

export function getBlacklistForLang(lang = "ALL") {
  const { blocklists } = getFiltersConfig();
  return mergeAllFirst(blocklists, lang);
}

export function getNeutralForLang(lang = "ALL") {
  const { neutrals } = getFiltersConfig();
  return mergeAllFirst(neutrals, lang);
}
