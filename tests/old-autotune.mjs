#!/usr/bin/env node
/**
 * /tests/autotune.mjs
 *
 * Small helper that measures wall-clock time for running the torture suite
 * across a set of --parallel values and prints a compact summary table.
 *
 * Usage (baseline, no AI):
 *   node ./tests/autotune.mjs \
 *     --ai=off \
 *     --par=12,16,20,24,28 \
 *     --runs=1 \
 *     --suite=./tests/Super-torture-suite.repo.mjs \
 *     --input=./tests/fixtures/test-cases-full.json,./tests/fixtures \
 *     --langs=SE,EN,DA,DE \
 *     --seed=1337 \
 *     --dedup-threshold=0.12 \
 *     --assert-lang=true \
 *     --ignore-case-lang=true
 *
 * Usage (AI auto; requires testmode=true in .env.local):
 *   node ./tests/autotune.mjs --ai=auto --par=4,6,8 --runs=1 ...same flags
 */

import { spawnSync } from 'node:child_process';
import process from 'node:process';

function parseArgs(argv){
  const out = {
    ai: 'off',
    par: [12,16,20,24,28],
    runs: 1,
    suite: './tests/Super-torture-suite.repo.mjs',
    input: './tests/fixtures/test-cases-full.json,./tests/fixtures',
    langs: 'SE,EN,DA,DE',
    report: './reports',
    seed: 1337,
    dedup: 0.12,
    assertLang: true,
    ignoreCaseLang: true,
    extra: [],
  };
  for (let i=2;i<argv.length;i++){
    const a=argv[i];
    const [k,vRaw] = a.includes('=') ? a.split('=') : [a, argv[++i]];
    const v = vRaw ?? '';
    if (k==='--ai') out.ai = String(v).toLowerCase();
    else if (k==='--par') out.par = String(v).split(',').map(x=>parseInt(x,10)).filter(Boolean);
    else if (k==='--runs') out.runs = Math.max(1, parseInt(v,10)||1);
    else if (k==='--suite') out.suite = v;
    else if (k==='--input') out.input = v;
    else if (k==='--langs') out.langs = v;
    else if (k==='--report') out.report = v;
    else if (k==='--seed') out.seed = parseInt(v,10)||1337;
    else if (k==='--dedup-threshold' || k==='--dedup') out.dedup = Math.max(0,Math.min(1, parseFloat(v)||0.12));
    else if (k==='--assert-lang') out.assertLang = /^(1|true|on|yes)$/i.test(String(v));
    else if (k==='--ignore-case-lang') out.ignoreCaseLang = /^(1|true|on|yes)$/i.test(String(v));
    else if (k.startsWith('--')) out.extra.push(`${k}=${v}`); // passthrough for unknown flags
  }
  return out;
}

function ms(n){ return `${n.toFixed(1)} ms`; }
function s(n){ return `${n.toFixed(2)} s`; }

function runOnce(flags){
  const args = ['node', flags.suite,
    `--input=${flags.input}`,
    `--langs=${flags.langs}`,
    `--ai-fallback=${flags.ai}`,
    `--report=${flags.report}`,
    `--parallel=${flags.parallel}`,
    `--seed=${flags.seed}`,
    `--dedup-threshold=${flags.dedup}`,
    `--assert-lang=${flags.assertLang}`,
    `--ignore-case-lang=${flags.ignoreCaseLang}`,
    ...flags.extra,
  ];
  const t0 = process.hrtime.bigint();
  const child = spawnSync(process.execPath, args.slice(1), { stdio: 'pipe', encoding: 'utf8' });
  const t1 = process.hrtime.bigint();
  const wallMs = Number(t1 - t0) / 1e6;
  const ok = child.status === 0;
  return { ok, wallMs, stdout: child.stdout, stderr: child.stderr };
}

function pick(val, re){ const m = (val||'').match(re); return m ? m[1] : undefined; }

function summarizeRun(out){
  const counts = pick(out.stdout, /total=(\d+) pass=(\d+) fail=(\d+)/);
  const flags = pick(out.stdout, /flags:\s*(\{[^}]+\})/);
  return { wallMs: out.wallMs, ok: out.ok, counts, flagsRaw: flags };
}

(function main(){
  const cfg = parseArgs(process.argv);
  const rows = [];
  for (const p of cfg.par){
    let acc=0, best=Infinity; let lastSummary = null; let ok=true;
    for (let r=0;r<cfg.runs;r++){
      const res = runOnce({ ...cfg, parallel: p });
      const sum = summarizeRun(res); lastSummary = sum; ok = ok && res.ok;
      acc += res.wallMs; if (res.wallMs < best) best = res.wallMs;
    }
    const avg = acc / cfg.runs;
    rows.push({ parallel: p, runs: cfg.runs, ok, bestMs: best, avgMs: avg, summary: lastSummary });
  }
  // Print table
  const header = `Autotune results (ai=${cfg.ai}, runs=${cfg.runs})`;
  console.log(header);
  console.log('parallel\tbest\tavg\tOK');
  for (const r of rows){
    console.log(`${r.parallel}\t${s(r.bestMs/1000)}\t${s(r.avgMs/1000)}\t${r.ok?'yes':'no'}`);
  }
  const best = rows.slice().sort((a,b)=>a.avgMs-b.avgMs)[0];
  console.log(`\nSuggested --parallel=${best.parallel} (avg=${s(best.avgMs/1000)}, best=${s(best.bestMs/1000)})`);
})();
