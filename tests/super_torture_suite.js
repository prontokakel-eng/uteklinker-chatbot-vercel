#!/usr/bin/env node
/**
 * Super-torture-suite.mjs — ESM-only torture test runner for FAQ-first chatbot
 *
 * PURPOSE
 *  - Load many JSON test sources (incl. ./tests/test-cases-full.json)
 *  - Normalize + deduplicate (>240 unique across SE/EN/DA/DE)
 *  - Exercise pipeline: Gates/Filters → detect-lang → FAQ-lookup → (optional) AI fallback
 *  - Export reports: JSON summary + raw, and JUnit XML for CI
 *
 * ZERO-ASSUMPTIONS ABOUT PATHS
 *  - Do NOT hardcode imports to project internals. Instead, pass module paths via CLI flags
 *    e.g. --path.gates=./lib/gates/run-gates.js
 *         --path.detectLang=./lib/detect-lang-core.js
 *         --path.faqLookup=./lib/faq/faq-lookup.js
 *         --path.openai=./lib/openai-client.js
 *         --path.logger=./logs/logger.js
 *  - This obeys the "FRÅGA ALLTID om mapp-/filstruktur" rule (we require explicit paths).
 *
 * USAGE (examples)
 *  node ./tests/Super-torture-suite.mjs \
 *    --input ./tests/test-cases-full.json,./tests/fixtures \
 *    --langs SE,EN,DA,DE \
 *    --ai-fallback auto \
 *    --report ./reports \
 *    --limit 0 \
 *    --parallel 4 \
 *    --seed 1337 \
 *    --path.gates ./config/gates-runner.js \
 *    --path.detectLang ./lib/detect-lang-core.js \
 *    --path.faqLookup ./lib/faq/faq-lookup.js \
 *    --path.openai ./lib/openai-client.js \
 *    --path.logger ./logs/logger.js
 *
 * OUTPUTS
 *  - ./reports/torture-report.json  (summary + raw cases)
 *  - ./reports/junit.xml            (JUnit for CI)
 *
 * SECURITY / PRIVACY
 *  - No secrets are written in reports; environment is read from .env.local if present.
 *
 * NOTE ON CHANGES
 *  - This is a NEW file placed under /tests. No existing domain logic is changed.
 *  - Any adapters/wrappers you may later decide to add should go to /tests/utils/* and be documented.
 */

import { readFile, writeFile, mkdir, stat, readdir } from 'node:fs/promises';
import { existsSync, createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import os from 'node:os';
import crypto from 'node:crypto';

// -------------------------------
// Utility: minimal CLI arg parser
// -------------------------------
function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const [k, ...rest] = a.slice(2).split('=');
    const v = rest.length ? rest.join('=') : (argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true');
    // Support dotted keys like --path.gates
    k.split('.').reduce((o, key, idx, arr) => {
      if (idx === arr.length - 1) o[key] = v; else o[key] ||= {};
      return o[key];
    }, args);
  }
  return args;
}

const argv = parseArgs(process.argv);

// Defaults
const INPUTS = (argv.input ? String(argv.input).split(',') : ['./tests/test-cases-full.json']).map(s => s.trim());
const LANGS = new Set((argv.langs ? String(argv.langs) : 'SE,EN,DA,DE').split(',').map(s => s.trim().toUpperCase()));
const REPORT_DIR = argv.report ? String(argv.report) : './reports';
const LIMIT = Number(argv.limit ?? 0); // 0 = no limit
const PARALLEL = Math.max(1, Number(argv.parallel ?? 4));
const AI_FALLBACK_MODE = String(argv['ai-fallback'] ?? 'auto'); // auto|on|off
const SEED = argv.seed ? Number(argv.seed) : 0;
const DEDUP_THRESHOLD = Math.max(0, Math.min(1, Number(argv['dedup-threshold'] ?? 0.1))); // normalized distance

const PATHS = {
  gates: argv.path?.gates,
  detectLang: argv.path?.detectLang,
  faqLookup: argv.path?.faqLookup,
  openai: argv.path?.openai,
  logger: argv.path?.logger,
};

// -------------------------------
// Simple env loader (.env.local)
// -------------------------------
async function loadDotEnvLocal(cwd = process.cwd()) {
  const dotEnvPath = path.resolve(cwd, '.env.local');
  if (!existsSync(dotEnvPath)) return {};
  const txt = await readFile(dotEnvPath, 'utf8');
  const env = {};
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim().replace(/^"|"$/g, '');
    env[key] = val;
  }
  return env;
}

// Decide AI fallback enabled?
async function resolveAiFallbackMode() {
  if (AI_FALLBACK_MODE === 'on') return true;
  if (AI_FALLBACK_MODE === 'off') return false;
  const envLocal = await loadDotEnvLocal();
  // Respect testmode in .env.local if present ("testmode=true|false")
  const raw = envLocal.testmode ?? envLocal.TESTMODE ?? process.env.testmode ?? process.env.TESTMODE;
  if (typeof raw === 'string') return /^(1|true|on|yes)$/i.test(raw);
  return true; // default for 'auto' if unspecified
}

// -------------------------------
// Logging (pluggable)
// -------------------------------
const logger = {
  info: (...a) => console.log('[INFO]', ...a),
  warn: (...a) => console.warn('[WARN]', ...a),
  error: (...a) => console.error('[ERROR]', ...a),
  debug: (...a) => { if (process.env.DEBUG) console.debug('[DEBUG]', ...a); },
};

async function tryLoadLogger() {
  if (!PATHS.logger) return logger;
  const mod = await dynamicImport(PATHS.logger);
  const cand = mod?.logger || mod?.default || mod;
  if (cand && typeof cand.info === 'function') return cand;
  return logger;
}

// -------------------------------
// Dynamic module import helper
// -------------------------------
async function dynamicImport(maybePath) {
  if (!maybePath) return null;
  const abs = path.isAbsolute(maybePath) ? maybePath : path.resolve(process.cwd(), maybePath);
  // Node ESM can import via file URL
  return import(pathToFileURL(abs).href);
}

// -------------------------------
// Text normalization & dedup
// -------------------------------
function normalizeText(t) {
  if (typeof t !== 'string') return '';
  const nfkc = t.normalize('NFKC');
  const collapsed = nfkc.replace(/\s+/g, ' ').trim();
  return collapsed;
}

function stripDiacritics(t) {
  return t.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
}

function levenshtein(a, b, max = Infinity) {
  // Early exits
  if (a === b) return 0;
  const la = a.length; const lb = b.length;
  if (!la) return lb; if (!lb) return la;
  if (Math.abs(la - lb) > max) return max + 1;
  // DP with two rows
  const v0 = new Array(lb + 1);
  const v1 = new Array(lb + 1);
  for (let j = 0; j <= lb; j++) v0[j] = j;
  for (let i = 0; i < la; i++) {
    v1[0] = i + 1;
    const ca = a.charCodeAt(i);
    for (let j = 0; j < lb; j++) {
      const cost = ca === b.charCodeAt(j) ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= lb; j++) v0[j] = v1[j];
    if (Math.min(...v0) > max) return max + 1; // pruning
  }
  return v0[lb];
}

function deduplicateCases(cases, threshold = DEDUP_THRESHOLD) {
  // Threshold is normalized distance (0..1) vs longer length
  const out = [];
  const sigs = [];
  for (const c of cases) {
    const raw = typeof c?.text === 'string' ? c.text : '';
    const norm = normalizeText(raw);
    if (!norm) continue;
    const lower = stripDiacritics(norm.toLowerCase());
    let duplicate = false;
    for (const s of sigs) {
      const dist = levenshtein(lower, s);
      const longer = Math.max(lower.length, s.length) || 1;
      const ratio = dist / longer;
      if (ratio <= threshold) { duplicate = true; break; }
    }
    if (!duplicate) {
      out.push({ ...c, text: norm });
      sigs.push(lower);
    }
  }
  return out;
}

// -------------------------------
// IO helpers: load JSON files from inputs (file or dir)
// -------------------------------
async function isDirectory(p) {
  try { const st = await stat(p); return st.isDirectory(); } catch { return false; }
}

async function listJsonFiles(p) {
  const files = [];
  const abs = path.resolve(p);
  if (await isDirectory(abs)) {
    const entries = await readdir(abs, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(abs, e.name);
      if (e.isDirectory()) files.push(...await listJsonFiles(full));
      else if (e.isFile() && e.name.toLowerCase().endsWith('.json')) files.push(full);
    }
  } else if (abs.toLowerCase().endsWith('.json')) {
    files.push(abs);
  }
  return files;
}

async function loadTestCases(inputs) {
  const files = (await Promise.all(inputs.map(listJsonFiles))).flat();
  const loaded = [];
  for (const f of files) {
    try {
      const txt = await readFile(f, 'utf8');
      const json = JSON.parse(txt);
      if (Array.isArray(json)) loaded.push(...json);
      else if (json && Array.isArray(json.cases)) loaded.push(...json.cases);
      else logger.warn('Ignored JSON (no array):', f);
    } catch (e) {
      logger.error('Failed to parse', f, e.message);
    }
  }
  return loaded;
}

// -------------------------------
// Seeded RNG & shuffling (determinism)
// -------------------------------
function mulberry32(seed) {
  let t = seed >>> 0;
  return function() {
    t += 0x6D2B79F5; let r = Math.imul(t ^ t >>> 15, 1 | t);
    r ^= r + Math.imul(r ^ r >>> 7, 61 | r);
    return ((r ^ r >>> 14) >>> 0) / 4294967296;
  };
}
function shuffleInPlace(arr, seed = 0) {
  if (!seed) return arr;
  const rand = mulberry32(seed);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// -------------------------------
// Adapters (dynamic)
// -------------------------------
async function loadAdapters() {
  const log = await tryLoadLogger();

  if (!PATHS.gates) throw new Error('Missing --path.gates (module with runGates({...}) → {allowed:boolean, reason?:string})');
  if (!PATHS.detectLang) throw new Error('Missing --path.detectLang (module with detectLang(text) → "SE"|"EN"|"DA"|"DE")');
  if (!PATHS.faqLookup) throw new Error('Missing --path.faqLookup (module with faqLookup({text, lang, topN}))');
  // openai is optional unless AI fallback is on

  const gatesMod = await dynamicImport(PATHS.gates);
  const detectLangMod = await dynamicImport(PATHS.detectLang);
  const faqLookupMod = await dynamicImport(PATHS.faqLookup);
  const openaiMod = PATHS.openai ? await dynamicImport(PATHS.openai) : null;

  const runGates = gatesMod?.runGates || gatesMod?.default || gatesMod?.run || null;
  if (typeof runGates !== 'function') throw new Error('Gates module must export function runGates (or default)');

  const detectLang = detectLangMod?.detectLang || detectLangMod?.default || detectLangMod?.detect || null;
  if (typeof detectLang !== 'function') throw new Error('DetectLang module must export function detectLang (or default)');

  const faqLookup = faqLookupMod?.faqLookup || faqLookupMod?.default || faqLookupMod?.lookup || null;
  if (typeof faqLookup !== 'function') throw new Error('FAQ lookup module must export function faqLookup (or default/lookup)');

  let aiClient = null;
  if (openaiMod) {
    aiClient = openaiMod?.ask || openaiMod?.chat || openaiMod?.default || null;
    if (aiClient && typeof aiClient !== 'function') aiClient = null; // expect a function
  }

  return { logger: log, runGates, detectLang, faqLookup, aiClient };
}

// -------------------------------
// Evaluation helpers
// -------------------------------
function parseExpected(expected) {
  // Flexible schema: string or object
  if (!expected) return { kind: 'unknown' };
  if (typeof expected === 'string') {
    const s = expected.toLowerCase();
    if (s.includes('blocked')) return { kind: 'blocked' };
    if (s.includes('no-match')) return { kind: 'no-match' };
    return { kind: 'faq', faqId: expected };
  }
  if (typeof expected === 'object') {
    if (expected.blocked) return { kind: 'blocked' };
    if (expected.noMatch || expected['no-match']) return { kind: 'no-match' };
    const faqId = expected.faqId || expected.id || expected.faq || expected.answerId;
    if (faqId) return { kind: 'faq', faqId };
  }
  return { kind: 'unknown' };
}

function pickPrimaryCandidate(candidates) {
  if (!Array.isArray(candidates) || candidates.length === 0) return null;
  // Assume candidates sorted by score desc. If not, try to sort by score property.
  const sorted = [...candidates].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  return sorted[0];
}

function evaluateOutcome({ gate, lang, lookup, ai, test, expectedParsed }) {
  // Returns {status: 'pass'|'fail'|'skipped', reason}
  switch (expectedParsed.kind) {
    case 'blocked':
      return gate && gate.allowed === false
        ? { status: 'pass', reason: 'Blocked as expected' }
        : { status: 'fail', reason: `Expected blocked but gate.allowed=${gate?.allowed}` };
    case 'no-match': {
      if (lookup?.hit) return { status: 'fail', reason: 'Expected no-match but lookup.hit=true' };
      if (ai?.used) return { status: 'fail', reason: 'Expected no-match but AI was used' };
      return { status: 'pass', reason: 'No-match as expected' };
    }
    case 'faq': {
      if (!lookup?.hit) return { status: 'fail', reason: 'Expected FAQ hit but none found' };
      const primary = pickPrimaryCandidate(lookup?.candidates) || {};
      if (String(primary.id ?? primary.faqId ?? '') === String(expectedParsed.faqId)) {
        return { status: 'pass', reason: 'FAQ match id matched expected' };
      }
      return { status: 'fail', reason: `FAQ mismatch: got ${primary.id ?? primary.faqId}, want ${expectedParsed.faqId}` };
    }
    default:
      return { status: 'skipped', reason: 'No expected provided; informational only' };
  }
}

// -------------------------------
// Concurrency runner
// -------------------------------
async function runPool(items, concurrency, worker) {
  const ret = new Array(items.length);
  let idx = 0; let active = 0;
  return await new Promise((resolve) => {
    const next = () => {
      if (idx >= items.length && active === 0) return resolve(ret);
      while (active < concurrency && idx < items.length) {
        const i = idx++;
        active++;
        Promise.resolve(worker(items[i], i)).then((r) => { ret[i] = r; })
          .catch((e) => { ret[i] = { error: e?.message || String(e) }; })
          .finally(() => { active--; next(); });
      }
    };
    next();
  });
}

// -------------------------------
// Main pipeline per test case
// -------------------------------
async function runSingleCase({ caseData, adapters, aiEnabled, topN = 5 }) {
  const { runGates, detectLang, faqLookup, aiClient, logger } = adapters;
  const timers = {};
  const t0 = performance.now();

  // 1) Gates/Filters
  const g0 = performance.now();
  const gate = await runGates({ text: caseData.text, lang: caseData.lang });
  const g1 = performance.now(); timers.gateMs = g1 - g0;
  if (gate && gate.allowed === false) {
    const t1b = performance.now();
    return {
      gate,
      detect: null,
      lookup: null,
      ai: { used: false },
      latencyMs: { total: t1b - t0, gate: timers.gateMs },
      decision: 'blocked',
    };
  }

  // 2) Language detection (if missing)
  const d0 = performance.now();
  const lang = caseData.lang || await detectLang(caseData.text);
  const d1 = performance.now(); timers.detectMs = d1 - d0;

  // 3) FAQ lookup
  const l0 = performance.now();
  const lookup = await faqLookup({ text: caseData.text, lang, topN });
  const l1 = performance.now(); timers.lookupMs = l1 - l0;

  // 4) AI fallback
  let ai = { used: false };
  if (!lookup?.hit && aiEnabled) {
    if (!adapters.aiClient) throw new Error('AI fallback enabled but --path.openai not provided');
    const a0 = performance.now();
    const answer = await adapters.aiClient({ text: caseData.text, lang, contextFaqs: lookup?.candidates || [] });
    const a1 = performance.now(); timers.aiMs = a1 - a0;
    ai = { used: true, ...answer };
  }

  const t1 = performance.now();
  return {
    gate,
    detect: { lang },
    lookup,
    ai,
    latencyMs: { total: t1 - t0, ...timers },
    decision: lookup?.hit ? 'faq' : (ai.used ? 'ai' : 'no-match'),
  };
}

// -------------------------------
// Reporting
// -------------------------------
function ensureDirSyncLike(dir) { return mkdir(dir, { recursive: true }); }

function toJUnitXML(suiteName, results) {
  const cases = results.map((r) => {
    const safeName = (r.input?.text || '').slice(0, 120).replace(/[<>]/g, '');
    const timeSec = (r.metrics?.latency?.total || 0) / 1000;
    if (r.status === 'pass' || r.status === 'skipped') {
      return `<testcase name="${escapeXml(safeName)}" time="${timeSec.toFixed(6)}"></testcase>`;
    }
    const reason = escapeXml(r.reason || '');
    return `<testcase name="${escapeXml(safeName)}" time="${timeSec.toFixed(6)}"><failure message="${reason}">${reason}</failure></testcase>`;
  }).join('\n');
  const failures = results.filter(r => r.status === 'fail').length;
  const tests = results.length;
  return `<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${escapeXml(suiteName)}" tests="${tests}" failures="${failures}">\n${cases}\n</testsuite>`;
}

function escapeXml(str) {
  return String(str).replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));
}

// -------------------------------
// MAIN
// -------------------------------
(async function main() {
  const adapters = await loadAdapters();
  const aiEnabled = await resolveAiFallbackMode();
  const { logger } = adapters;

  logger.info('AI fallback enabled:', aiEnabled);
  logger.info('Reading inputs:', INPUTS);

  let raw = await loadTestCases(INPUTS);
  if (SEED) raw = shuffleInPlace(raw, SEED);

  // Normalize + filter by langs
  const normalized = raw.map((c, idx) => ({
    id: c.id ?? `case_${idx}`,
    text: normalizeText(c.text ?? ''),
    lang: c.lang ? String(c.lang).toUpperCase() : undefined,
    expected: c.expected,
    category: c.category,
    meta: { ...(c.meta || {}) },
  })).filter(c => c.text);

  const deduped = deduplicateCases(normalized, DEDUP_THRESHOLD).filter(c => !c.lang || LANGS.has(c.lang));
  const sliced = LIMIT > 0 ? deduped.slice(0, LIMIT) : deduped;

  if (deduped.length < 240) {
    adapters.logger.warn(`WARNING: deduplicated cases (${deduped.length}) < 240. Add more fixtures or relax threshold.`);
  }

  await ensureDirSyncLike(REPORT_DIR);

  // Execute with concurrency
  const resultsRaw = await runPool(sliced, PARALLEL, async (caseData) => {
    const expectedParsed = parseExpected(caseData.expected);
    const run = await runSingleCase({ caseData, adapters, aiEnabled, topN: 5 });
    const evalRes = evaluateOutcome({ gate: run.gate, lang: run.detect?.lang, lookup: run.lookup, ai: run.ai, test: caseData, expectedParsed });

    return {
      id: caseData.id,
      input: { text: caseData.text, lang: caseData.lang, category: caseData.category },
      expected: caseData.expected || null,
      outcome: {
        gate: run.gate,
        detect: run.detect,
        lookup: {
          hit: !!run.lookup?.hit,
          primary: pickPrimaryCandidate(run.lookup?.candidates || []) || null,
          candidates: (run.lookup?.candidates || []).slice(0, 10),
        },
        ai: { used: !!run.ai?.used, tokens_in: run.ai?.tokensIn, tokens_out: run.ai?.tokensOut },
      },
      metrics: { latency: run.latencyMs },
      decision: run.decision,
      status: evalRes.status,
      reason: evalRes.reason,
    };
  });

  // KPIs
  const kpi = computeKpis(resultsRaw);

  // Write reports
  const jsonOut = {
    meta: {
      generatedAt: new Date().toISOString(),
      aiEnabled,
      langs: [...LANGS],
      inputs: INPUTS,
      limit: LIMIT,
      parallel: PARALLEL,
      seed: SEED,
      dedupThreshold: DEDUP_THRESHOLD,
    },
    kpi,
    results: resultsRaw,
  };

  await writeFile(path.resolve(REPORT_DIR, 'torture-report.json'), JSON.stringify(jsonOut, null, 2), 'utf8');
  await writeFile(path.resolve(REPORT_DIR, 'junit.xml'), toJUnitXML('FAQ Super Torture Suite', resultsRaw), 'utf8');

  // Console summary
  printSummary(kpi, adapters.logger);
})().catch((err) => {
  console.error('\nFATAL:', err?.stack || err?.message || String(err));
  process.exit(1);
});

// -------------------------------
// KPI computation & summary
// -------------------------------
function computeKpis(results) {
  const totals = { count: results.length, pass: 0, fail: 0, skipped: 0 };
  const perLang = {};
  const perKind = { blocked: 0, faq: 0, ai: 0, noMatch: 0 };
  const latency = { gate: [], detect: [], lookup: [], ai: [], total: [] };

  for (const r of results) {
    totals[r.status]++;
    const lang = r.outcome?.detect?.lang || r.input?.lang || 'UNK';
    perLang[lang] ||= { count: 0, pass: 0, fail: 0, skipped: 0 };
    perLang[lang].count++;
    perLang[lang][r.status]++;

    const decision = r.decision;
    if (decision === 'faq') perKind.faq++;
    else if (decision === 'ai') perKind.ai++;
    else if (decision === 'no-match') perKind.noMatch++;
    else if (decision === 'blocked') perKind.blocked++;

    const m = r.metrics?.latency || {};
    if (typeof m.gate === 'number') latency.gate.push(m.gate);
    if (typeof m.detect === 'number') latency.detect.push(m.detect);
    if (typeof m.lookup === 'number') latency.lookup.push(m.lookup);
    if (typeof m.ai === 'number') latency.ai.push(m.ai);
    if (typeof m.total === 'number') latency.total.push(m.total);
  }

  const precisionFaq = precisionOnExpectedFaq(results);

  return {
    totals,
    perLang,
    perKind,
    latency: {
      p50: mapObj(latency, p => percentile(p, 50)),
      p95: mapObj(latency, p => percentile(p, 95)),
    },
    precisionFaq, // computed only where expected.kind==='faq'
  };
}

function mapObj(obj, fn) { const out = {}; for (const k of Object.keys(obj)) out[k] = fn(obj[k]); return out; }
function percentile(arr, p) {
  if (!arr || arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function precisionOnExpectedFaq(results) {
  const relevant = results.filter(r => {
    const exp = parseExpected(r.expected);
    return exp.kind === 'faq';
  });
  if (relevant.length === 0) return null;
  const correct = relevant.filter(r => r.status === 'pass').length;
  return { cases: relevant.length, correct, precision: correct / relevant.length };
}

function printSummary(kpi, log) {
  log.info('--- SUMMARY ---');
  log.info('Totals:', kpi.totals);
  if (kpi.precisionFaq) log.info('Precision (FAQ expected):', `${(kpi.precisionFaq.precision * 100).toFixed(1)}%`, `(${kpi.precisionFaq.correct}/${kpi.precisionFaq.cases})`);
  log.info('Per kind:', kpi.perKind);
  log.info('Latency P95 (ms):', mapObj(kpi.latency.p95, v => v != null ? v.toFixed(2) : null));
}
