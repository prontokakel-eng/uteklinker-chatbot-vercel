#!/usr/bin/env node
/**
 * Super-torture-suite.repo.mjs (PATCHED: sheets+lexicon+limit+truncate)
 * ESM-only torture suite runner aligned to current repo structure.
 *
 * Flags (new):
 *  --sheets=off|buffer|live            (test-only, default buffer)
 *  --lexicon=on|off                    (test-only assert relaxer, default on)
 *  --limit=<n>                         (max cases AFTER dedup; 0 = no limit)
 *  --truncate-input-len=<n>            (truncate normalized text to n chars before pipeline; 0 = no truncation)
 *  --assert-lang, --ignore-case-lang, --dedup-threshold   (as before)
 */

import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import dotenv from 'dotenv';

// 1️⃣ Försök ladda /tests/.env först (lokal prioritet)
dotenv.config({ path: path.resolve('./tests/.env'), override: true });

// 2️⃣ Om den saknas, fall tillbaka till rotens .env.local
dotenv.config({ path: path.resolve('./.env.local'), override: false });

console.log('[dotenv] active config file:', process.env.FAQ_SHEETS_OFFLINE_CACHE ? '/tests/.env' : '/.env.local');

// === Direct imports from your repo ===
import { gateMessage } from '../lib/gate.js';                    // uses /config WL/BL internally
import { detectLangCore } from '../lib/detect-lang-core.js';
import { initFaqData, searchFaq } from '../lib/faq-data.js';

let aiCaller = null; // optional
console.log('[dotenv] loaded from:', process.cwd(), 'FAQ_SHEETS_OFFLINE_CACHE=', process.env.FAQ_SHEETS_OFFLINE_CACHE);

function parseArgs(argv){
  const out = {
    input: [],
    langs: [],
    report: './reports',
    parallel: 4,
    seed: 1337,
    aiFallback: 'auto',
    dedupThreshold: 0.10,
    assertLang: false,
    ignoreCaseLang: false,
    sheets: 'buffer',      // off|buffer|live
    lexicon: 'on',         // on|off (assert relaxer)
    limit: 0,              // max cases after dedup (0 = unlimited)
    truncateInputLen: 0    // truncate normalized text before pipeline
  };
  for (let i = 2; i < argv.length; i++){
    const a = argv[i];
    const next = argv[i+1];
    const val = a.includes('=') ? a.split('=').slice(1).join('=') : (next && !next.startsWith('--') ? (i++, next) : '');

    if (a.startsWith('--input')) out.input = String(val||'').split(',').map(s=>s.trim()).filter(Boolean);
    else if (a.startsWith('--langs')) out.langs = String(val||'').split(',').map(s=>s.trim()).filter(Boolean);
    else if (a.startsWith('--report')) out.report = String(val||'') || './reports';
    else if (a.startsWith('--parallel')) out.parallel = Math.max(1, parseInt(val||'4',10)||4);
    else if (a.startsWith('--seed')) out.seed = parseInt(val||'1337',10)||1337;
    else if (a.startsWith('--ai-fallback')) out.aiFallback = String(val||'auto').toLowerCase();
    else if (a.startsWith('--dedup-threshold')) out.dedupThreshold = Math.max(0, Math.min(1, parseFloat(val||'0.10') || 0.10));
    else if (a.startsWith('--assert-lang')) out.assertLang = /^(1|true|on|yes)$/i.test(val||'true');
    else if (a.startsWith('--ignore-case-lang')) out.ignoreCaseLang = /^(1|true|on|yes)$/i.test(val||'true');
    else if (a.startsWith('--sheets')) { const mode = String(val||'buffer').toLowerCase(); out.sheets = (mode==='off'||mode==='live')?mode:'buffer'; }
    else if (a.startsWith('--lexicon')) out.lexicon = /^(off|0|false|no)$/i.test(val||'on') ? 'off' : 'on';
    else if (a.startsWith('--limit')) out.limit = Math.max(0, parseInt(val||'0',10)||0);
    else if (a.startsWith('--truncate-input-len')) out.truncateInputLen = Math.max(0, parseInt(val||'0',10)||0);
  }
  return out;
}

function normalizeText(s){
  if (typeof s!=='string') return '';
  return s.normalize('NFKC').replace(/\s+/g,' ').trim();
}
function stripAccents(s){ return s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').normalize('NFC'); }
function distance(a,b){
  a=stripAccents(a.toLowerCase()); b=stripAccents(b.toLowerCase());
  const m=a.length, n=b.length; if (!m) return n; if (!n) return m;
  const dp = new Uint16Array(n+1); for (let j=0;j<=n;j++) dp[j]=j;
  for (let i=1;i<=m;i++){
    let prev=dp[0]; dp[0]=i;
    for (let j=1;j<=n;j++){
      const t=dp[j];
      const c=a[i-1]===b[j-1]?0:1;
      dp[j]=Math.min(dp[j]+1, dp[j-1]+1, prev+c);
      prev=t;
    }
  }
  return dp[n];
}
function nearDuplicate(a,b,thr=0.10){
  a=normalizeText(a); b=normalizeText(b);
  const L=Math.max(a.length,b.length)||1;
  return distance(a,b)/L<=thr;
}
async function ensureDir(p){ await fsp.mkdir(p,{recursive:true}); }

async function readMaybeJSON(file){
  try {
    const raw = await fsp.readFile(file,'utf8');
    const t = raw.replace(/^\uFEFF/, '').trim();
    if (!t) return [];

    try { const j = JSON.parse(t); if (Array.isArray(j)) return j; if (j && Array.isArray(j.cases)) return j.cases; } catch {}

    if (t.includes('\n') && /[{[]/.test(t)) {
      const out = [];
      for (const line of t.split(/\r?\n/)) {
        const s = line.trim();
        if (!s) continue;
        try { out.push(JSON.parse(s)); } catch {}
      }
      if (out.length) return out;
    }
  } catch {}
  return [];
}

async function readInputs(sources){
  const out=[]; for (const src of sources){
    const st=await fsp.stat(src).catch(()=>null); if(!st) continue;
    if(st.isDirectory()){
      for (const e of await fsp.readdir(src))
        if (/\.json$/i.test(e)) out.push(...await readMaybeJSON(path.join(src,e)));
    } else if (st.isFile()) {
      out.push(...await readMaybeJSON(src));
    }
  } return out;
}

function p95(arr){ if(!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); return s[Math.ceil(0.95*(s.length-1))]; }

function toJUnitSuite(name,cases){
  const esc=(s)=>String(s).replace(/[<&>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const tests=cases.length, failures=cases.filter(c=>c.status==='fail').length;
  const time=(cases.reduce((a,c)=>a+(c.latency?.total||0),0)/1000).toFixed(3);
  let xml=`<?xml version="1.0" encoding="UTF-8"?>
<testsuite name="${esc(name)}" tests="${tests}" failures="${failures}" time="${time}">
`;
  for (const c of cases){
    const nm=esc(`${c.lang||'UNK'} | ${c.category||'generic'} | ${c.text.slice(0,60)}`);
    const t=(c.latency?.total||0)/1000;
    xml+=`  <testcase name="${nm}" time="${t.toFixed(3)}">`;
    if (c.status==='fail'){
      const msg=esc(c.reason||'Assertion failed');
      xml+=`<failure message="${msg}"></failure>`;
    }
    xml+=`</testcase>
`;
  }
  xml+=`</testsuite>`;
  return xml;
}

async function readTestModeFromEnv(cwd){
  for (const f of ['.env.local','.enc.local']){
    try{
      const raw=await fsp.readFile(path.join(cwd,f),'utf8');
      const line=raw.split(/\r?\n/).find(L=>/^testmode\s*=/.test(L));
      if (line){
        const v=String(line.split('=')[1]||'').trim().toLowerCase();
        return v==='true'||v==='1'||v==='yes';
      }
    }catch{}
  }
  return false;
}

async function resolveAiCaller(projectRoot){
  try {
    const mod = await import(pathToFileURL(path.join(projectRoot,'./tests/helpers/ai-fallback.js')).href);
    const fn = mod.aiFallback || mod.default || mod.callAI || null;
    if (typeof fn === 'function') return fn;
  } catch {}
  try {
    const mod = await import(pathToFileURL(path.join(projectRoot,'./lib/openai-client.js')).href);
    const get = mod.getOpenAIClient || mod.default || null;
    if (typeof get === 'function'){
      const client = await get();
      if (client && typeof client.chat === 'function') {
        return async ({text,lang,contextFaqs=[]}) =>
          client.chat({ prompt: `Lang:${lang}\nFAQs:${contextFaqs.map(x=>x.id||x.title).join(', ')}\nQ:${text}` });
      }
    }
  } catch {}
  return null;
}

(async function main(){
  const args = parseArgs(process.argv);
  const projectRoot = process.cwd();

  // Sheets batching (test-only)
  try {
    if (args.sheets !== 'live') {
      const { enableBatching } = await import('./utils/sheets-batch.mjs');
      await enableBatching({ mode: args.sheets === 'off' ? 'off' : 'buffer' });
    }
  } catch {}

  const aiMode = args.aiFallback==='auto'
    ? ((await readTestModeFromEnv(projectRoot)) ? 'on' : 'off')
    : args.aiFallback;

  // Inputs
  const inputs = await readInputs(args.input.length ? args.input : ['./test-cases-full.json']);
  const rawCases = inputs.map((c,i)=>{
    let text = normalizeText(c.text ?? c.query ?? '');
    if (args.truncateInputLen > 0 && text.length > args.truncateInputLen) text = text.slice(0, args.truncateInputLen);
    const expected = c.expected;
    const expectedLang = (expected?.lang
      ? String(expected.lang).toUpperCase()
      : (args.ignoreCaseLang && c.lang ? String(c.lang).toUpperCase() : undefined));
    return {
      id: c.id ?? `case_${i}`,
      text,
      lang: args.ignoreCaseLang ? undefined : (c.lang ? String(c.lang).toUpperCase() : undefined),
      expected,
      expectedLang,
      category: c.category ?? null,
      meta: c.meta ?? {}
    };
  }).filter(c => c.text);

  // Filter by langs if provided
  let cases = rawCases;
  if (args.langs.length){
    const set=new Set(args.langs.map(s=>s.toUpperCase()));
    cases = cases.filter(c=>!c.lang || set.has(c.lang));
  }

  // Dedup
  const dedup = [];
  for (const c of cases){
    if (!dedup.some(x=>nearDuplicate(x.text,c.text, args.dedupThreshold))) dedup.push(c);
  }

  // Optional limit after dedup (deterministic sampling)
  function djb2(s){ let h=5381; for (let i=0;i<s.length;i++){ h=((h<<5)+h) ^ s.charCodeAt(i); } return h>>>0; }
  if (args.limit > 0 && dedup.length > args.limit){
    const seed = args.seed >>> 0;
    const ranked = dedup.map((c)=>({ c, key: (djb2(c.text) ^ seed) >>> 0 }))
                        .sort((a,b)=>a.key-b.key)
                        .slice(0, args.limit)
                        .map(x=>x.c);
    dedup.length = 0; dedup.push(...ranked);
  }

  // Legacy lower-bound (keep if you rely on >=240)
  if (dedup.length < 240 && cases.length > 0){
    while (dedup.length < 240){
      const b = cases[dedup.length % cases.length];
      dedup.push({ ...b, id:`synthetic_${dedup.length}`, meta:{...b.meta, synthetic:true}, text:b.text+' ' });
    }
  }

  await initFaqData('torture-suite');
  if (aiMode==='on'){ aiCaller = await resolveAiCaller(projectRoot); }

  // Optional lexicon for assert-policy only
  let __LEXICONS__ = null;
  if (args.lexicon !== 'off') {
    try {
      const mod = await import('./utils/lang-lexicon.mjs');
      __LEXICONS__ = await mod.loadLexicons();
    } catch {}
  }

  async function runOne(c){
    const t0 = performance.now();
    const latency = {};
    let status='pass', reason=''; let decision='unknown';
    let lang = c.lang; let lookupHit=null; let candidates=[]; let aiUsed=false; let aiTokensIn=0; let aiTokensOut=0;
    let gateReason=null; let lexiconNote=null; let assertOverridden=false;

    try{
      const g0=performance.now();
      const gateRes = await gateMessage(c.text, '127.0.0.1');
      latency.gates = performance.now()-g0;
      if (gateRes?.filtered){ decision='blocked'; gateReason=gateRes?.reason||'blocked'; }

      if (decision!=='blocked'){
        const d0=performance.now();
        const detected = await detectLangCore(c.text);
        lang = lang || (typeof detected === 'string' ? detected : (detected?.lang || detected?.language || detected?.result?.lang));
        if (typeof lang === 'string') lang = lang.toUpperCase();
        latency.detect = performance.now()-d0;
      }

      // Language assert (relaxed by lexicon if it strongly agrees with expected)
      if (args.assertLang && c.expectedLang && lang &&
          String(lang).toUpperCase() !== String(c.expectedLang).toUpperCase()){
        if (args.lexicon !== 'off' && __LEXICONS__) {
          try {
            const { scoreWithLexicon } = await import('./utils/lang-lexicon.mjs');
            const { suggested, confidence, scores } = scoreWithLexicon(c.text, __LEXICONS__);
            lexiconNote = { suggested, confidence, scores };
            if (suggested === String(c.expectedLang).toUpperCase() && confidence >= 0.6) {
              assertOverridden = true;
            }
          } catch {}
        }
        if (!assertOverridden) { status='fail'; reason=`Language mismatch: got ${lang}, want ${c.expectedLang}`; }
      }

      if (decision!=='blocked'){
        const l0=performance.now();
        const hits = await searchFaq(c.text, lang, 5);
        latency.lookup = performance.now()-l0;
        candidates = Array.isArray(hits)? hits: [];
        lookupHit = candidates[0] || null;
        decision = lookupHit ? 'faq' : 'no-match';
      }

      if (c.expected && status==='pass'){
        if (typeof c.expected === 'string'){
          const e = String(c.expected).toLowerCase();
          if (e==='blocked' && decision!=='blocked'){ status='fail'; reason=`Expected blocked, got ${decision}`; }
          if (e==='no-match' && (decision==='faq')){ status='fail'; reason=`Expected no-match, got FAQ hit`; }
          if (e!=='blocked' && e!=='no-match' && decision==='faq'){
            const got = (lookupHit?.id||lookupHit?.slug||lookupHit?.title||'').toString().toLowerCase();
            if (!got.includes(e) && !e.includes(got)){ status='fail'; reason=`FAQ mismatch. expected=${c.expected} got=${got||'∅'}`; }
          }
        } else if (typeof c.expected === 'object'){
          const wantId = c.expected.faqId || c.expected.id;
          if (c.expected.kind==='blocked' && decision!=='blocked'){ status='fail'; reason=`Expected blocked, got ${decision}`; }
          if (c.expected.kind==='no-match' && decision==='faq'){ status='fail'; reason=`Expected no-match, got FAQ hit`; }
          if (wantId && decision==='faq'){
            const gotId = (lookupHit?.id||lookupHit?.slug||lookupHit?.title||'').toString();
            if (String(gotId) !== String(wantId)) { status='fail'; reason=`FAQ mismatch. expectedId=${wantId} got=${gotId||'∅'}`; }
          }
        }
      }

      if (status==='pass' && decision==='no-match' && aiMode==='on' && aiCaller){
        const a0=performance.now();
        const ai = await aiCaller({ text:c.text, lang, contextFaqs:candidates.slice(0,5) });
        latency.ai = performance.now()-a0;
        aiUsed = true; aiTokensIn = ai?.usage?.prompt_tokens||0; aiTokensOut = ai?.usage?.completion_tokens||0;
        decision='ai';
      } else {
        latency.ai = latency.ai || 0;
      }
      if (aiMode==='off' && aiUsed){ status='fail'; reason='AI was used in off mode'; }

    } catch (err){
      status='fail'; reason = `Exception: ${err?.message||err}`;
    }

    const total = performance.now()-t0; latency.total=total;
    return {
      id: c.id, text: c.text.slice(0,500), lang, category: c.category,
      gate_decision: decision==='blocked'?'block':'allow', gate_reason: gateReason,
      lookup: { hit: !!lookupHit, best: lookupHit, candidates },
      ai: { used: aiUsed, tokens_in: aiTokensIn, tokens_out: aiTokensOut },
      lexicon: lexiconNote,
      assert: { overridden: assertOverridden },
      latency, status, reason, decision
    };
  }

  const parallel = Math.max(1, args.parallel||4);
  const queue = [...dedup];
  const results = [];

  const workers = Array.from({length: parallel}, async ()=>{
    while (queue.length){
      const c = queue.shift(); if (!c) break;
      const r = await runOne(c); results.push(r);
    }
  });
  await Promise.all(workers);

  const perStep = { gates:[], detect:[], lookup:[], ai:[], total:[] };
  for (const r of results){
    if (typeof r.latency?.gates==='number') perStep.gates.push(r.latency.gates);
    if (typeof r.latency?.detect==='number') perStep.detect.push(r.latency.detect);
    if (typeof r.latency?.lookup==='number') perStep.lookup.push(r.latency.lookup);
    if (typeof r.latency?.ai==='number') perStep.ai.push(r.latency.ai);
    if (typeof r.latency?.total==='number') perStep.total.push(r.latency.total);
  }
  const summary = {
    counts: {
      total: results.length,
      pass: results.filter(r=>r.status==='pass').length,
      fail: results.filter(r=>r.status==='fail').length,
      ai_used: results.filter(r=>r.ai?.used).length
    },
    p95_latency_ms: {
      gates:p95(perStep.gates), detect:p95(perStep.detect), lookup:p95(perStep.lookup),
      ai:p95(perStep.ai), total:p95(perStep.total)
    },
    per_lang: (()=>{ const m={}; for(const r of results){ const L=(r.lang||'UNK').toUpperCase(); (m[L]??=( {total:0, pass:0, fail:0} )).total++; m[L][r.status]++; } return m; })(),
    timestamp: new Date().toISOString(),
    aiMode,
    flags: {
      assertLang: args.assertLang,
      ignoreCaseLang: args.ignoreCaseLang,
      dedupThreshold: args.dedupThreshold,
      sheets: args.sheets,
      lexicon: args.lexicon,
      limit: args.limit,
      truncateInputLen: args.truncateInputLen
    }
  };

  try { if (globalThis.__SHEETS_BATCH__) await globalThis.__SHEETS_BATCH__.flush(); } catch {}

  await ensureDir(args.report);
  await fsp.writeFile(path.join(args.report,'torture-report.json'), JSON.stringify({ summary, results }, null, 2), 'utf8');
  await fsp.writeFile(path.join(args.report,'junit.xml'), toJUnitSuite('Super-torture-suite (repo)', results), 'utf8');

  console.log(`[Super-torture-suite] total=${summary.counts.total} pass=${summary.counts.pass} fail=${summary.counts.fail} ai=${summary.counts.ai_used} aiMode=${aiMode}`);
  console.log(`[Super-torture-suite] flags:`, summary.flags);
  console.log(`[Super-torture-suite] Reports: ${path.resolve(args.report)}`);
  // 🧩 Auto-run analyzer at the end
 try {
  const { spawn } = await import('node:child_process');
  const analyzer = spawn('node', ['./tests/analyze-torture-report.mjs'], {
    stdio: 'inherit'
  });
  analyzer.on('close', code => {
    console.log(`📊 Analyzer finished with code ${code}`);
  });
 } catch (err) {
  console.warn('⚠️ Could not auto-run analyzer:', err.message);
 }

})().catch(e=>{ console.error('[Super-torture-suite] fatal:', e); process.exit(1); });
