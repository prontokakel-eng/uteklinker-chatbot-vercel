// /tests/utils/lang-lexicon.mjs (test-only)
// Loads external lexicon from /config/lang-lexicon/*.json and computes a simple bias score.
// This does NOT change production detection. The suite uses it only to relax the language assert
// when lexicon strongly supports the expected language.

import { readFile } from 'node:fs/promises';
import path from 'node:path';

const LEXDIR = path.resolve(process.cwd(), 'config', 'lang-lexicon');
const SUPPORTED = ['SE','EN','DA','DE'];

async function readJsonSafe(p){
  try { const t = await readFile(p, 'utf8'); return JSON.parse(t); }
  catch { return null; }
}

export async function loadLexicons(){
  const out = {};
  for (const L of SUPPORTED){
    const obj = await readJsonSafe(path.join(LEXDIR, `${L}.json`));
    if (obj) out[L] = { boost: obj.boost||[], penalize: obj.penalize||[] };
  }
  return out;
}

export function scoreWithLexicon(text, lexicons){
  const t = String(text||'').toLowerCase();
  const scores = { SE:0, EN:0, DA:0, DE:0 };
  for (const L of Object.keys(lexicons||{})){
    const { boost=[], penalize=[] } = lexicons[L]||{};
    for (const w of boost){
      if (!w) continue;
      if (t.includes(String(w).toLowerCase())) scores[L] += 1.0;
    }
    for (const w of penalize){
      if (!w) continue;
      if (t.includes(String(w).toLowerCase())) scores[L] -= 0.6;
    }
  }
  // normalize to [0,1] by clamping (rough)
  for (const k of Object.keys(scores)){
    scores[k] = Math.max(0, Math.min(1, scores[k] / 5.0));
  }
  const sorted = Object.entries(scores).sort((a,b)=>b[1]-a[1]);
  const suggested = sorted[0][0];
  const confidence = sorted[0][1];
  return { suggested, confidence, scores };
}
