// /config/lexicon/lexicon-loader.js
// ESM loader för språklexikon (SE/EN/DA/DE) i JSON-format.
// Cachear resultat i minnet för snabbare access och validerar schema.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const cache = Object.create(null);

// ──────────────────────────────────────────────────────────────────────────────
// Schema-validering (ingen extern lib; minimal och defensiv)
// ──────────────────────────────────────────────────────────────────────────────
function isStringArray(x) {
  return Array.isArray(x) && x.every(v => typeof v === 'string');
}
function clampNum(x, lo = 0, hi = 10, def = 0) {
  const n = Number.isFinite(x) ? x : def;
  return Math.min(hi, Math.max(lo, n));
}
function asStringArray(x) {
  if (!Array.isArray(x)) return [];
  return x.filter(v => typeof v === 'string');
}
function lowerTrim(a) {
  return a.map(s => s.trim()).filter(Boolean);
}

/**
 * Validerar och normaliserar lexikonobjektet.
 * Bevarar kända nycklar; fyller på defaults för saknade.
 * Loggar varningar när något saknas/är fel typ.
 * // BEVARA extras
 */
function validateLexicon(raw, langKey = 'SE') {
  const warn = (msg) => console.warn(`[lexicon-loader] ⚠️ ${langKey}: ${msg}`);

  const meta = (raw && typeof raw.meta === 'object') ? raw.meta : { version: '0.0.0' };

  const articles  = lowerTrim(asStringArray(raw?.articles));
  const negations = lowerTrim(asStringArray(raw?.negations));
  const common    = lowerTrim(asStringArray(raw?.common));
  const EXTRA_ARRAY_KEYS = new Set(['fallbackTriggers','stopwords','bigrams','trigrams']);
  const EXTRA_OBJECT_KEYS = new Set(['accentMap','geoMapping','aliases']);
  const out = { meta, articles, negations, common };
  
  if (!articles.length)  warn(`'articles' saknas eller tomt; default []`);
  if (!negations.length) warn(`'negations' saknas eller tomt; default []`);
  if (!common.length)    warn(`'common' saknas eller tomt; default []`);

  for (const k of EXTRA_ARRAY_KEYS) {
  if (Array.isArray(raw?.[k])) out[k] = raw[k].map(s=>String(s).trim()).filter(Boolean);
  }
  for (const k of EXTRA_OBJECT_KEYS) {
  if (raw?.[k] && typeof raw[k] === 'object' && !Array.isArray(raw[k])) {
    out[k] = raw[k]; // lämna orört
  }
}


  // regex: { prefix: string[], suffix: string[] }
  const regex = {
    prefix: isStringArray(raw?.regex?.prefix) ? raw.regex.prefix : [],
    suffix: isStringArray(raw?.regex?.suffix) ? raw.regex.suffix : [],
  };
  if (!regex.prefix.length && !regex.suffix.length) {
    warn(`'regex.prefix/suffix' saknas eller tomt; default []`);
  }

  // weights: { articles, negations, common, regex } – numeriska och vettiga intervall
  const DEFAULT_WEIGHTS = { articles: 0.5, negations: 0.5, common: 0.5, regex: 0.5 };
  const weightsRaw = (raw && typeof raw.weights === 'object') ? raw.weights : {};
  const weights = {
    articles: clampNum(weightsRaw.articles, 0, 5, DEFAULT_WEIGHTS.articles),
    negations: clampNum(weightsRaw.negations, 0, 5, DEFAULT_WEIGHTS.negations),
    common: clampNum(weightsRaw.common, 0, 5, DEFAULT_WEIGHTS.common),
    regex: clampNum(weightsRaw.regex, 0, 5, DEFAULT_WEIGHTS.regex),
  };

  // Sanity: varna för tomt lexikon helt och hållet
  const totalSignals = articles.length + negations.length + common.length + regex.prefix.length + regex.suffix.length;
  if (totalSignals === 0) {
    warn(`Tomt lexikon (inga signaler).`);
  }

  // Returnera endast de nycklar som övrig kod förväntar sig
  return { ...out, regex, weights };
}

// ──────────────────────────────────────────────────────────────────────────────
// Loader
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Laddar ett språklexikon från ./config/lexicon/{LANG}_FULL_LOOKUP.json
 * @param {'SE'|'EN'|'DA'|'DE'} lang
 * @returns {Promise<Object>} lexikonobjekt (validerat; kan vara {})
 */
export async function loadLexicon(lang = 'SE') {
  const key = String(lang || 'SE').toUpperCase();
  if (cache[key]) return cache[key];

  const file = path.resolve('./config/lexicon', `${key}_FULL_LOOKUP.json`);
  try {
    const parsed = JSON.parse(await readFile(file, 'utf8'));
    const data = validateLexicon(parsed, key);
    cache[key] = data;

    if (process.env.NODE_ENV === 'test') {
      console.log(
        `[lexicon-loader] ✅ Loaded ${key}_FULL_LOOKUP.json ` +
        `(sections: articles=${data.articles.length}, negations=${data.negations.length}, ` +
        `common=${data.common.length}, regex.prefix=${data.regex.prefix.length}, regex.suffix=${data.regex.suffix.length})`
      );
    }
    return data;
  } catch (err) {
    console.warn(`[lexicon-loader] ⚠️ Missing or invalid lexicon for ${key}: ${err.message}`);
    cache[key] = validateLexicon({}, key); // tomt, men korrekt schema
    return cache[key];
  }
}

export default { loadLexicon };
