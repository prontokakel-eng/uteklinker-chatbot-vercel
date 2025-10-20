// scripts/sanitize-lexicons.mjs
// Sanity check + dedupe för ./config/lexicon/*_FULL_LOOKUP.json
// - Hanterar flera JSON-objekt i samma fil (concatenated JSON)
// - Union/dedupe av listor, merge av regex, max(weights)
// - Skriver tillbaka EN giltig JSON med backup .bak

import { readFile, writeFile, copyFile, stat } from 'node:fs/promises';
import path from 'node:path';

const ROOT = process.cwd();
const DIR = path.resolve(ROOT, 'config', 'lexicon');
const FILES = ['SE_FULL_LOOKUP.json','EN_FULL_LOOKUP.json','DA_FULL_LOOKUP.json','DE_FULL_LOOKUP.json'];

function uniqLowerTrim(arr) {
  const out = [];
  const seen = new Set();
  for (const v of Array.isArray(arr) ? arr : []) {
    if (typeof v !== 'string') continue;
    const s = v.trim();
    if (!s) continue;
    const k = s.toLowerCase();
    if (!seen.has(k)) { seen.add(k); out.push(s); }
  }
  return out;
}

function clampNum(x, lo = 0, hi = 5, def = 0.5) {
  const n = Number.isFinite(x) ? x : def;
  return Math.min(hi, Math.max(lo, n));
}

function validateLexicon(raw, langKey='?') {
  const meta = (raw && typeof raw.meta === 'object') ? raw.meta : { version: '0.0.0' };
  const articles  = uniqLowerTrim(raw?.articles);
  const negations = uniqLowerTrim(raw?.negations);
  const common    = uniqLowerTrim(raw?.common);
  const regex = {
    prefix: uniqLowerTrim(raw?.regex?.prefix),
    suffix: uniqLowerTrim(raw?.regex?.suffix),
  };
  const wr = (raw && typeof raw.weights === 'object') ? raw.weights : {};
  const weights = {
    articles: clampNum(wr.articles),
    negations: clampNum(wr.negations),
    common: clampNum(wr.common),
    regex: clampNum(wr.regex),
  };
  return { meta, articles, negations, common, regex, weights };
}

// Fångar ALLA topp-nivå JSON-objekt i en sträng (concatenated JSON)
function splitTopLevelObjects(text) {
  const objs = [];
  let depth = 0, start = -1, inStr = false, esc = false;
  for (let i=0; i<text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) { esc = false; }
      else if (ch === '\\') { esc = true; }
      else if (ch === '"') { inStr = false; }
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === '{') { if (depth === 0) start = i; depth++; }
    else if (ch === '}') { depth--; if (depth === 0 && start !== -1) { objs.push(text.slice(start, i+1)); start = -1; } }
  }
  return objs;
}

function mergeLexicons(parts) {
  // Start med tom struktur
  const acc = {
    meta: { version: '1.0.0', normalized: true },
    articles: [],
    negations: [],
    common: [],
    regex: { prefix: [], suffix: [] },
    weights: { articles: 0.5, negations: 0.5, common: 0.5, regex: 0.5 },
  };

  for (const p of parts) {
    acc.articles.push(...(Array.isArray(p.articles) ? p.articles : []));
    acc.negations.push(...(Array.isArray(p.negations) ? p.negations : []));
    acc.common.push(...(Array.isArray(p.common) ? p.common : []));
    if (p.regex) {
      acc.regex.prefix.push(...(Array.isArray(p.regex.prefix) ? p.regex.prefix : []));
      acc.regex.suffix.push(...(Array.isArray(p.regex.suffix) ? p.regex.suffix : []));
    }
    // weights: ta max per fält (konservativt)
    if (p.weights && typeof p.weights === 'object') {
      acc.weights.articles = Math.max(acc.weights.articles, Number(p.weights.articles) || 0);
      acc.weights.negations = Math.max(acc.weights.negations, Number(p.weights.negations) || 0);
      acc.weights.common = Math.max(acc.weights.common, Number(p.weights.common) || 0);
      acc.weights.regex = Math.max(acc.weights.regex, Number(p.weights.regex) || 0);
    }
  }

  // Dedupe + validate
  const validated = validateLexicon(acc);
  return validated;
}

async function processFile(file) {
  const full = path.join(DIR, file);
  try {
    await stat(full);
  } catch {
    console.warn(`⚠️ Missing file: ${file} (skip)`);
    return null;
  }

  const raw = await readFile(full, 'utf8');

  let parts = [];
  // 1) Försök enkel JSON
  try {
    parts = [JSON.parse(raw)];
  } catch {
    // 2) Försök hitta flera objekt i samma fil
    const blocks = splitTopLevelObjects(raw);
    for (const b of blocks) {
      try { parts.push(JSON.parse(b)); } catch {}
    }
  }

  if (!parts.length) {
    console.warn(`⚠️ ${file}: no parseable JSON objects found.`);
    // Skriv inte om filen, men returnera tom strukt
    return { file, before: { objs: 0 }, after: { objs: 0 } };
  }

  // Mergning
  const merged = mergeLexicons(parts);

  // Skriv backup + ny fil
  await copyFile(full, full + '.bak');
  await writeFile(full, JSON.stringify(merged, null, 2) + '\n', 'utf8');

  const stats = {
    articles: merged.articles.length,
    negations: merged.negations.length,
    common: merged.common.length,
    regexPrefix: merged.regex.prefix.length,
    regexSuffix: merged.regex.suffix.length,
    weights: merged.weights
  };

  console.log(`✅ ${file} → normalized:`, stats);
  return { file, before: { objs: parts.length }, after: { objs: 1, ...stats } };
}

(async function main(){
  const results = [];
  for (const f of FILES) {
    results.push(await processFile(f));
  }
  console.log('\nSummary:', results);
})().catch(e=>{ console.error('fatal:', e); process.exit(1); });
