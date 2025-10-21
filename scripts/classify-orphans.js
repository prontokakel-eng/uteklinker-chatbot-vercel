// ESM. Kör: node scripts/classify-orphans.js --source logs/audit-log-final.txt --out logs/reports/orphans-plan.json
import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);
function flag(name, def) {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : def;
}

const REPORT_DIR = 'logs/reports';
const KNIP = path.join(REPORT_DIR, 'knip-orphans.json');
const SOURCE = flag('source', 'logs/audit-log-final.txt');
const OUT = flag('out', path.join(REPORT_DIR, 'orphans-plan.json'));
const DYN = path.join(REPORT_DIR, 'dynamic-refs.txt');

function ensureDir(p) { fs.mkdirSync(p, { recursive: true }); }

function loadKnipOrphans() {
  if (!fs.existsSync(KNIP)) return null;
  const raw = JSON.parse(fs.readFileSync(KNIP, 'utf8'));
  const files = new Set();
  const sources = [raw.problems?.unusedFiles, raw.unusedFiles, raw.files].filter(Boolean);
  for (const src of sources) {
    for (const f of src) files.add((f.file || f).replace(/^.\//, ''));
  }
  return [...files];
}

function parseAuditLogOrphans(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const txt = fs.readFileSync(filePath, 'utf8');
  const marker = '=== graph:orphans';
  const i = txt.indexOf(marker);
  if (i < 0) return [];
  const segment = txt.slice(i);
  const start = segment.indexOf('[');
  const end = segment.indexOf(']');
  if (start < 0 || end < 0 || end <= start) return [];
  const inside = segment.slice(start + 1, end);
  // poster som 'fil.js', eventuellt med radbrytningar
  return inside
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/^[,'"\s]+|[,'"\s]+$/g, '')) // trimma citattecken/komma
    .filter(Boolean);
}

function loadDynamicRefs() {
  if (!fs.existsSync(DYN)) return new Set();
  const txt = fs.readFileSync(DYN, 'utf8');
  // vi bryr oss bara om basnamn för grov match
  const bases = new Set();
  for (const line of txt.split('\n')) {
    const m = line.match(/([^\/\\:\s]+\.m?js)/i);
    if (m) bases.add(m[1].toLowerCase());
  }
  return bases;
}

function classify(files, dynBases) {
  const plan = [];
  for (const file of files) {
    const base = path.basename(file).toLowerCase();
    // default
    let tier = 'O2';
    let reason = 'generic util; no static refs';

    if (/(_backup|backup|last ver|old|legacy|deprecated)/.test(base)) {
      tier = 'O1'; reason = 'backup/legacy naming';
    }
    if (/featureflag\.\d{4}-\d{2}-\d{2}_\d{6}/.test(base)) {
      tier = 'O1'; reason = 'dated feature flag';
    }
    if (/chatpipeline|faq-(dialog|search|keywords)/.test(base)) {
      tier = 'O3'; reason = 'central-sounding, verify dynamic import';
    }
    if (dynBases.has(base)) {
      tier = 'O3'; reason = 'seen in dynamic-refs';
    }
    if (/^ai\.js$|^policy\.js$|^utils(-progress)?\.js$|^blacklist-regex\.js$/.test(base)) {
      if (tier !== 'O3') { tier = 'O2'; reason = 'generic util; likely safe'; }
    }

    plan.push({ file, tier, reason });
  }
  const order = { O1: 0, O2: 1, O3: 2 };
  plan.sort((a, b) => order[a.tier] - order[b.tier] || a.file.localeCompare(b.file));
  return plan;
}

function main() {
  ensureDir(REPORT_DIR);

  const fromKnip = loadKnipOrphans();
  const candidates = fromKnip ?? parseAuditLogOrphans(SOURCE);
  if (!candidates || candidates.length === 0) {
    console.error('No orphan candidates found (knip or audit log). Provide --source if needed.');
    process.exit(2);
  }

  const dyn = loadDynamicRefs();
  const plan = classify(candidates, dyn);
  const payload = { generatedAt: new Date().toISOString(), source: fromKnip ? 'knip' : SOURCE, items: plan };

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2), 'utf8');
  console.log(`Wrote ${OUT} with ${plan.length} items (${payload.source}).`);
}

main();
