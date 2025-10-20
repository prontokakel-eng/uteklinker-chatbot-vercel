// tools/fix-lexicon-one.mjs
// Hoist fields from extras.extras → top-level for a single *_FULL_LOOKUP.json.
// - Moves `extras.extras.normalize` => top-level `normalize`
// - Moves `extras.extras.regexAnchors` => top-level `anchors`
// - Ensures anchor arrays and object keys exist
// - Keeps originals (does not delete) unless --prune is passed
// - Creates .bak backup unless --dry
//
// Usage:
//   node ./tools/fix-lexicon-one.mjs --file ./config/lexicon/EN_FULL_LOOKUP.json
//   node ./tools/fix-lexicon-one.mjs --file ./config/lexicon/EN_FULL_LOOKUP.json --prune
//   node ./tools/fix-lexicon-one.mjs --file ./config/lexicon/EN_FULL_LOOKUP.json --dry
//
import fs from 'fs';
import path from 'path';

const args = new Map();
for (let i = 2; i < process.argv.length; i++) {
  const k = process.argv[i];
  const v = process.argv[i+1] && !process.argv[i+1].startsWith('--') ? process.argv[++i] : true;
  args.set(k, v);
}

const FILE = args.get('--file');
const DRY = args.has('--dry');
const PRUNE = args.has('--prune');

if (!FILE) {
  console.error('Missing --file <path-to-*_FULL_LOOKUP.json>');
  process.exit(2);
}

function isPlainObject(o){ return o && typeof o === 'object' && !Array.isArray(o); }

function ensureNormalizeShape(j){
  let changed = false;
  const src = j?.extras?.extras?.normalize;
  if (!j.normalize && isPlainObject(src)) {
    j.normalize = { methods: Array.isArray(src.methods) ? src.methods : [], remove: Array.isArray(src.remove) ? src.remove : [] };
    changed = true;
    if (PRUNE) delete j.extras.extras.normalize;
  }
  if (!isPlainObject(j.normalize)) {
    j.normalize = { methods: [], remove: [] };
    changed = true;
  } else {
    if (!Array.isArray(j.normalize.methods)) { j.normalize.methods = []; changed = true; }
    if (!Array.isArray(j.normalize.remove))  { j.normalize.remove  = []; changed = true; }
  }
  return changed;
}

function ensureAnchors(j){
  let changed = false;
  // prefer existing top-level
  let node = j.anchors ?? j.regexAnchors;
  if (!isPlainObject(node)) {
    // try hoist from extras.extras.regexAnchors
    const src = j?.extras?.extras?.regexAnchors;
    if (isPlainObject(src)) node = { exclusive: Array.isArray(src.exclusive) ? src.exclusive : [], soft: Array.isArray(src.soft) ? src.soft : [] };
    else node = { exclusive: [], soft: [] };
    changed = true;
    if (PRUNE && j?.extras?.extras?.regexAnchors) delete j.extras.extras.regexAnchors;
  } else {
    if (!Array.isArray(node.exclusive)) { node.exclusive = []; changed = true; }
    if (!Array.isArray(node.soft))      { node.soft      = []; changed = true; }
  }
  // write back to `anchors`
  j.anchors = node;
  if (j.regexAnchors) delete j.regexAnchors;
  return changed;
}

function ensureObject(j, key){
  if (!isPlainObject(j[key])) { j[key] = {}; return true; }
  return false;
}

function main(){
  const fp = path.resolve(process.cwd(), FILE);
  let raw;
  try { raw = fs.readFileSync(fp, 'utf-8'); }
  catch(e){ console.error(`read fail: ${fp} (${e.message})`); process.exit(1); }

  let json;
  try { json = JSON.parse(raw); }
  catch(e){ console.error(`invalid JSON: ${fp} (${e.message})`); process.exit(1); }

  let changed = false;
  changed = ensureNormalizeShape(json) || changed;
  changed = ensureAnchors(json) || changed;
  changed = ensureObject(json, 'accentMap') || changed;
  changed = ensureObject(json, 'geoMapping') || changed;
  changed = ensureObject(json, 'weights') || changed;

  if (!changed) {
    console.log('No changes necessary.');
    return;
  }

  if (DRY) {
    console.log('[dry] would update', fp);
    console.log(JSON.stringify(json, null, 2));
    return;
  }

  const bak = fp + '.bak';
  fs.writeFileSync(bak, raw, 'utf-8');
  fs.writeFileSync(fp, JSON.stringify(json, null, 2), 'utf-8');
  console.log(`Updated ${fp} (backup at ${bak})`);
}

main();