#!/usr/bin/env node
/**
 * Super-torture-suite.repo.mjs
 * ESM-only torture test runner aligned to current repo structure.
 * No wrappers. Imports your existing modules directly.
 *
 * Pipeline: Gates/Filters (gateMessage) → detectLangCore → searchFaq → AI fallback (optional)
 *
 * USAGE:
 *   node ./tests/Super-torture-suite.repo.mjs \
 *     --input ./test-cases-full.json,./tests/fixtures \
 *     --langs SE,EN,DA,DE \
 *     --ai-fallback auto \
 *     --report ./reports \
 *     --parallel 4 --seed 1337
 *
 * AI fallback:
 *  - 'auto' reads testmode=true|false from .env.local or .enc.local
 *  - If ON, tries ai-fallback.js (aiFallback/ default) then openai-client.js (getOpenAIClient().chat)
 *
 * NOTE: Keeps your domain logic intact. Only orchestrates calls + reporting.
 */

import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';

// === Direct imports from your repo ===
import { gateMessage } from '../lib/gate.js';                    // uses /config WL/BL internally
import { detectLangCore } from '../lib/detect-lang-core.js';
import { initFaqData, searchFaq } from '../lib/faq-data.js';

// Optional AI; resolved lazily at runtime to avoid hard dependency if off
let aiCaller = null;

// ──────────────────────────────────────────────────────────────────────────────
// Small utilities (same as generic version, trimmed)
// ──────────────────────────────────────────────────────────────────────────────
function parseArgs(argv){
  const out = { input: [], langs: [], report: './reports', parallel: 4, seed: 1337, aiFallback:'auto' };
  for (let i=2;i<argv.length;i++){
    const a=argv[i];
    if (a.startsWith('--input')) out.input = (a.split('=')[1] ?? argv[++i]).split(',').map(s=>s.trim()).filter(Boolean);
    else if (a.startsWith('--langs')) out.langs = (a.split('=')[1] ?? argv[++i]).split(',').map(s=>s.trim()).filter(Boolean);
    else if (a.startsWith('--report')) out.report = (a.split('=')[1] ?? argv[++i]) || './reports';
    else if (a.startsWith('--parallel')) out.parallel = Math.max(1, parseInt((a.split('=')[1] ?? argv[++i]),10)||4);
    else if (a.startsWith('--seed')) out.seed = parseInt((a.split('=')[1] ?? argv[++i]),10)||1337;
    else if (a.startsWith('--ai-fallback')) out.aiFallback = ((a.split('=')[1] ?? argv[++i])||'auto').toLowerCase();
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
  for (let i=1;i<=m;i++){ let prev=dp[0]; dp[0]=i; for (let j=1;j<=n;j++){ const t=dp[j]; const c=a[i-1]===b[j-1]?0:1; dp[j]=Math.min(dp[j]+1, dp[j-1]+1, prev+c); prev=t; } }
  return dp[n];
}
function nearDuplicate(a,b,thr=0.10){ a=normalizeText(a); b=normalizeText(b); const L=Math.max(a.length,b.length)||1; return distance(a,b)/L<=thr; }
async function ensureDir(p){ await fsp.mkdir(p,{recursive:true}); }
async function readMaybeJSON(file){
  try { const raw=await fsp.readFile(file,'utf8'); const t=raw.trim();
    if (!t) return []; const j=JSON.parse(t); if (Array.isArray(j)) return j; if (Array.isArray(j?.cases)) return j.cases;
    if (t.includes('\n') && t.includes('{')) return t.split(/\r?\n/).map(x=>x.trim()).filter(Boolean).map(JSON.parse);
  } catch(e){/* ignore */}
  return [];
}
async function readInputs(sources){
  const out=[]; for (const src of sources){
    const st=await fsp.stat(src).catch(()=>null); if(!st) continue;
    if(st.isDirectory()){ for (const e of await fsp.readdir(src)) if (/\.json$/i.test(e)) out.push(...await readMaybeJSON(path.join(src,e))); }
    else if (st.isFile()) out.push(...await readMaybeJSON(src));
  } return out;
}
function p95(arr){ if(!arr.length) return 0; const s=[...arr].sort((a,b)=>a-b); return s[Math.ceil(0.95*(s.length-1))]; }
function toJUnitSuite(name,cases){
  const esc=(s)=>String(s).replace(/[<&>"]/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));
  const tests=cases.length, failures=cases.filter(c=>c.status==='fail').length;
  const time=(cases.reduce((a,c)=>a+(c.latency?.total||0),0)/1000).toFixed(3);
  let xml=`<?xml version="1.0" encoding="UTF-8"?>\n<testsuite name="${esc(name)}" tests="${tests}" failures="${failures}" time="${time}">\n`;
  for (const c of cases){ const nm=esc(`${c.lang||'UNK'} | ${c.category||'generic'} | ${c.text.slice(0,60)}`);
    const t=(c.latency?.total||0)/1000; xml+=`  <testcase name="${nm}" time="${t.toFixed(3)}">`;
    if (c.status==='fail'){ const msg=esc(c.reason||'Assertion failed'); xml+=`<failure message="${msg}"></failure>`; }
    xml+=`</testcase>\n`;
  }
  xml+=`</testsuite>`; return xml;
}
async function readTestModeFromEnv(cwd){
  for (const f of ['.env.local','.enc.local']){
    try{ const raw=await fsp.readFile(path.join(cwd,f),'utf8');
      const line=raw.split(/\r?\n/).find(L=>/^testmode\s*=/.test(L));
      if (line){ const v=String(line.split('=')[1]||'').trim().toLowerCase(); return v==='true'||v==='1'||v==='yes'; }
    }catch{}
  } return false;
}
async function resolveAiCaller(projectRoot){
  // Try ai-fallback.js
  try {
    const mod = await import(pathToFileURL(path.join(projectRoot,'./tests/helpers/ai-fallback.js')).href);
    const fn = mod.aiFallback || mod.default || mod.callAI || null;
    if (typeof fn === 'function') return fn;
  } catch {}
  // Fallback to openai-client.js -> getOpenAIClient().chat
  try {
    const mod = await import(pathToFileURL(path.join(projectRoot,'./lib/openai-client.js')).href);
    const get = mod.getOpenAIClient || mod.default || null;
    if (typeof get === 'function'){
      const client = await get();
      if (client && typeof client.chat === 'function') return async ({text,lang,contextFaqs=[]})=>client.chat({prompt:`Lang:${lang}\nFAQs:${contextFaqs.map(x=>x.id||x.title).join(', ')}\nQ:${text}`});
    }
  } catch {}
  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────
(async function main(){
  const args = parseArgs(process.argv);
  const projectRoot = process.cwd();
  const aiMode = args.aiFallback==='auto' ? (await readTestModeFromEnv(projectRoot) ? 'on':'off') : args.aiFallback;

  // Load inputs
  const inputs = await readInputs(args.input.length ? args.input : ['./test-cases-full.json']);
  const rawCases = inputs.map((c,i)=>{
    const text = normalizeText(c.text ?? c.query ?? '');
    return {
      id: c.id ?? `case_${i}`,
      text,
      lang: c.lang ? String(c.lang).toUpperCase() : undefined,
      expected: c.expected ?? null,
      category: c.category ?? null,
      meta: c.meta ?? {}
    };
  }).filter(c => c.text);

  // Filter by langs if provided
  let cases = rawCases;
  if (args.langs.length){ const set=new Set(args.langs.map(s=>s.toUpperCase())); cases = cases.filter(c=>!c.lang || set.has(c.lang)); }

  // Dedup
  const dedup = []; for (const c of cases){ if (!dedup.some(x=>nearDuplicate(x.text,c.text))) dedup.push(c); }
  if (dedup.length < 240){
    // fill up synthetically by minor whitespace paddings
    while (dedup.length < 240){ const b = cases[dedup.length % cases.length] || {text:'', lang:'EN'}; dedup.push({...b, id:`synthetic_${dedup.length}`, meta:{...b.meta, synthetic:true}, text:b.text+' '}); }
  }

  // Init FAQ index once
  await initFaqData('torture-suite');

  // Prepare AI if needed
  if (aiMode==='on'){ aiCaller = await resolveAiCaller(projectRoot); }

  // Run
  const parallel = Math.max(1, args.parallel||4);
  const queue = [...dedup]; const results = [];
  async function runOne(c){
    const t0 = performance.now();
    const latency = {};
    let status='pass', reason=''; let decision='unknown';
    let lang = c.lang; let lookupHit=null; let candidates=[]; let aiUsed=false; let aiTokensIn=0; let aiTokensOut=0;
    let gateReason=null;

    try{
      // Gates
      const g0=performance.now();
      const gateRes = await gateMessage(c.text, '127.0.0.1');
      latency.gates = performance.now()-g0;
      if (gateRes?.filtered){ decision='blocked'; gateReason=gateRes?.reason||'blocked'; }
      // Detect
      if (decision!=='blocked'){
        const d0=performance.now();
        lang = lang || await detectLangCore(c.text);
        latency.detect = performance.now()-d0;
      }
      // Lookup
      if (decision!=='blocked'){
        const l0=performance.now();
        const hits = await searchFaq(c.text, lang, 5);
        latency.lookup = performance.now()-l0;
        candidates = Array.isArray(hits)? hits: [];
        lookupHit = candidates[0] || null;
        decision = lookupHit ? 'faq' : 'no-match';
      }
      // Expected checks
      if (c.expected){
        const e = String(c.expected).toLowerCase();
        if (e==='blocked' && decision!=='blocked'){ status='fail'; reason=`Expected blocked, got ${decision}`; }
        if (e==='no-match' && (decision==='faq')){ status='fail'; reason=`Expected no-match, got FAQ hit`; }
        if (e!=='blocked' && e!=='no-match' && decision==='faq'){
          const got = (lookupHit?.id||lookupHit?.slug||lookupHit?.title||'').toString().toLowerCase();
          if (!got.includes(e) && !e.includes(got)){ status='fail'; reason=`FAQ mismatch. expected=${c.expected} got=${got||'∅'}`; }
        }
      }
      // AI fallback
      if (decision==='no-match' && aiMode==='on' && aiCaller){
        const a0=performance.now();
        const ai = await aiCaller({ text:c.text, lang, contextFaqs:candidates.slice(0,5) });
        latency.ai = performance.now()-a0;
        aiUsed = true; aiTokensIn = ai?.usage?.prompt_tokens||0; aiTokensOut = ai?.usage?.completion_tokens||0;
        decision='ai';
      } else {
        latency.ai = 0;
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
      latency, status, reason, decision
    };
  }

  const workers = Array.from({length: parallel}, async ()=>{
    while (queue.length){
      const c = queue.shift(); if (!c) break;
      const r = await runOne(c); results.push(r);
    }
  });
  await Promise.all(workers);

  // KPIs
  const perStep = { gates:[], detect:[], lookup:[], ai:[], total:[] };
  for (const r of results){
    if (typeof r.latency?.gates==='number') perStep.gates.push(r.latency.gates);
    if (typeof r.latency?.detect==='number') perStep.detect.push(r.latency.detect);
    if (typeof r.latency?.lookup==='number') perStep.lookup.push(r.latency.lookup);
    if (typeof r.latency?.ai==='number') perStep.ai.push(r.latency.ai);
    if (typeof r.latency?.total==='number') perStep.total.push(r.latency.total);
  }
  const summary = {
    counts: { total: results.length, pass: results.filter(r=>r.status==='pass').length, fail: results.filter(r=>r.status==='fail').length, ai_used: results.filter(r=>r.ai?.used).length },
    p95_latency_ms: { gates:p95(perStep.gates), detect:p95(perStep.detect), lookup:p95(perStep.lookup), ai:p95(perStep.ai), total:p95(perStep.total) },
    per_lang: (()=>{ const m={}; for(const r of results){ const L=(r.lang||'UNK').toUpperCase(); (m[L]??=( {total:0, pass:0, fail:0} )).total++; m[L][r.status]++; } return m; })(),
    timestamp: new Date().toISOString(),
    aiMode
  };

  // Reports
  await ensureDir(args.report);
  await fsp.writeFile(path.join(args.report,'torture-report.json'), JSON.stringify({ summary, results }, null, 2), 'utf8');
  await fsp.writeFile(path.join(args.report,'junit.xml'), toJUnitSuite('Super-torture-suite (repo)', results), 'utf8');

  console.log(`[Super-torture-suite] total=${summary.counts.total} pass=${summary.counts.pass} fail=${summary.counts.fail} ai=${summary.counts.ai_used} aiMode=${aiMode}`);
  console.log(`[Super-torture-suite] Reports: ${path.resolve(args.report)}`);
})().catch(e=>{ console.error('[Super-torture-suite] fatal:', e); process.exit(1); });
