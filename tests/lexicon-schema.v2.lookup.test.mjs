// tests/lexicon-schema.v2.lookup.test.mjs
// Default: validates only *_FULL_LOOKUP.json files (SE/EN/DA/DE).
// Fallback: if none found, validates all .json (to remain useful).
// Env:
//   LEXICON_DIR  - directory with lexicons (default: ./config/lexicon)
//   LEXICON_GLOB - substring to filter filenames (default: _FULL_LOOKUP.json)
//   VERBOSE=1    - print secondary errors
//
// Run:
//   node ./tests/lexicon-schema.v2.lookup.test.mjs
//   LEXICON_DIR=./config/lexicon node ./tests/lexicon-schema.v2.lookup.test.mjs

import fs from 'fs';
import path from 'path';

const LEXICON_DIR = process.env.LEXICON_DIR || path.resolve(process.cwd(), 'config', 'lexicon');
const FILTER_SUBSTR = process.env.LEXICON_GLOB || '_FULL_LOOKUP.json';
const VERBOSE = process.env.VERBOSE === '1';

function isPlainObject(o){ return o && typeof o === 'object' && !Array.isArray(o); }
const ok = m => console.log(`✓ ${m}`);
const warn = m => console.warn(`! ${m}`);
const fail = m => console.error(`✗ ${m}`);
const info = m => { if (VERBOSE) console.log(`i ${m}`); };

function validateFile(fp) {
  let raw;
  try { raw = fs.readFileSync(fp, 'utf-8'); }
  catch (e) { fail(`${path.basename(fp)} → cannot read (${e.message})`); return { file: fp, ok:false, error:'read-failed' }; }

  let json;
  try { json = JSON.parse(raw); }
  catch (e) { fail(`${path.basename(fp)} → invalid JSON (${e.message})`); return { file: fp, ok:false, error:'invalid-json' }; }

  const { normalize, accentMap, geoMapping, weights, anchors, regexAnchors } = json;
  const anchorNode = anchors ?? regexAnchors;
  const errs = [];

  if (!isPlainObject(normalize)) errs.push('`normalize` must be an object');
  if (!normalize || !Array.isArray(normalize.methods)) errs.push('`normalize.methods` must be an array');
  if (!normalize || !Array.isArray(normalize.remove)) errs.push('`normalize.remove` must be an array');
  if (!isPlainObject(accentMap)) errs.push('`accentMap` must be an object');
  if (!isPlainObject(geoMapping)) errs.push('`geoMapping` must be an object');
  if (!isPlainObject(weights)) errs.push('`weights` must be an object');

  if (!isPlainObject(anchorNode)) errs.push('`anchors` (or `regexAnchors`) must be an object');
  else {
    if (!Array.isArray(anchorNode.exclusive)) errs.push('`anchors.exclusive` must be an array');
    if (!Array.isArray(anchorNode.soft)) errs.push('`anchors.soft` must be an array');
    else {
      const badEx = anchorNode.exclusive.find(v => typeof v !== 'string');
      const badSoft = anchorNode.soft.find(v => typeof v !== 'string');
      if (badEx !== undefined) errs.push('`anchors.exclusive` must contain only strings');
      if (badSoft !== undefined) errs.push('`anchors.soft` must contain only strings');
    }
  }

  if (errs.length) {
    fail(`${path.basename(fp)} → ${errs[0]}`);
    errs.slice(1).forEach(e => info(`  - ${e}`));
    return { file: fp, ok:false, error: errs.join('; ') };
  }
  ok(path.basename(fp));
  return { file: fp, ok:true };
}

function main(){
  if (!fs.existsSync(LEXICON_DIR)) { warn(`Lexicon directory not found: ${LEXICON_DIR}`); process.exitCode=2; return; }
  let files = fs.readdirSync(LEXICON_DIR).filter(f => f.endsWith('.json'));
  let targeted = files.filter(f => f.includes(FILTER_SUBSTR));
  if (targeted.length === 0) {
    warn(`No files matching '*${FILTER_SUBSTR}'; falling back to all .json in ${LEXICON_DIR}`);
    targeted = files;
  }
  if (targeted.length === 0) { warn(`No .json files in ${LEXICON_DIR}`); process.exitCode=2; return; }

  const results = targeted.map(f => validateFile(path.join(LEXICON_DIR, f)));
  const failed = results.filter(r => !r.ok);
  console.log('— Summary —');
  console.log(`OK: ${results.length - failed.length}, Fail: ${failed.length}`);
  process.exitCode = failed.length ? 1 : 0;
}

main();
