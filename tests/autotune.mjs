#!/usr/bin/env node
/**
 * autotune.mjs
 * Grid-searcher for the Super-torture-suite with support for --limit and --truncate-input-len.
 * ESM-only, PowerShell-safe args. Measures wall time per run and captures exit code.
 *
 * Example:
 *  node ./tests/autotune.mjs \
 *    --ai=off \
 *    --par=12,16,20,24,28 \
 *    --runs=1 \
 *    --suite=./tests/Super-torture-suite.repo.mjs \
 *    --input=./tests/fixtures/test-cases-full.json,./tests/fixtures \
 *    --langs=SE,EN,DA,DE \
 *    --seed=1337 \
 *    --dedup-threshold=0.12 \
 *    --assert-lang=true \
 *    --ignore-case-lang=true \
 *    --sheets=buffer \
 *    --lexicon=on \
 *    --limit=600 \
 *    --truncate-input-len=180
 */

import { spawn } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import path from 'node:path';

function parseArgs(argv){
  const out = {
    ai: 'off',             // auto|on|off
    par: [12,16,20,24,28], // candidates
    runs: 1,
    suite: './tests/Super-torture-suite.repo.mjs',
    input: [],
    langs: [],
    seed: 1337,
    dedup: 0.12,
    report: './reports',
    assertLang: true,
    ignoreCaseLang: true,
    sheets: 'buffer',
    lexicon: 'on',
    limit: 0,
    truncate: 0
  };
  for (let i=2;i<argv.length;i++){
    const a = argv[i];
    const next = argv[i+1];
    const val = a.includes('=') ? a.split('=').slice(1).join('=') : (next && !next.startsWith('--') ? (i++, next) : '');
    if (a.startsWith('--ai')) out.ai = String(val||'off').toLowerCase();
    else if (a.startsWith('--par')) out.par = String(val||'').split(',').map(x=>parseInt(x,10)).filter(n=>Number.isFinite(n)&&n>0);
    else if (a.startsWith('--runs')) out.runs = Math.max(1, parseInt(val||'1',10)||1);
    else if (a.startsWith('--suite')) out.suite = String(val||'').trim() || out.suite;
    else if (a.startsWith('--input')) out.input = String(val||'').split(',').map(s=>s.trim()).filter(Boolean);
    else if (a.startsWith('--langs')) out.langs = String(val||'').split(',').map(s=>s.trim()).filter(Boolean);
    else if (a.startsWith('--seed')) out.seed = parseInt(val||'1337',10)||1337;
    else if (a.startsWith('--dedup-threshold')) out.dedup = Math.max(0, Math.min(1, parseFloat(val||'0.12')||0.12));
    else if (a.startsWith('--report')) out.report = String(val||'').trim() || out.report;
    else if (a.startsWith('--assert-lang')) out.assertLang = /^(1|true|on|yes)$/i.test(val||'true');
    else if (a.startsWith('--ignore-case-lang')) out.ignoreCaseLang = /^(1|true|on|yes)$/i.test(val||'true');
    else if (a.startsWith('--sheets')) { const m = String(val||'buffer').toLowerCase(); out.sheets = (m==='off'||m==='live')?m:'buffer'; }
    else if (a.startsWith('--lexicon')) out.lexicon = /^(off|0|false|no)$/i.test(val||'on') ? 'off' : 'on';
    else if (a.startsWith('--limit')) out.limit = Math.max(0, parseInt(val||'0',10) || 0);
    else if (a.startsWith('--truncate-input-len')) out.truncate = Math.max(0, parseInt(val||'0',10) || 0);
  }
  return out;
}

function runSuiteOnce({ suite, input, langs, ai, seed, dedup, report, assertLang, ignoreCaseLang, sheets, lexicon, limit, truncate, parallel }){
  const args = [
    suite,
    `--input=${input.join(',')}`,
    langs.length ? `--langs=${langs.join(',')}` : '',
    `--ai-fallback=${ai}`,
    `--report=${path.join(report, `par-${parallel}`)}`,
    `--parallel=${parallel}`,
    `--seed=${seed}`,
    `--dedup-threshold=${dedup}`,
    `--assert-lang=${assertLang?'true':'false'}`,
    `--ignore-case-lang=${ignoreCaseLang?'true':'false'}`,
    `--sheets=${sheets}`,
    `--lexicon=${lexicon}`,
    limit>0 ? `--limit=${limit}` : '',
    truncate>0 ? `--truncate-input-len=${truncate}` : ''
  ].filter(Boolean);

  return new Promise((resolve) => {
    const t0 = performance.now();
    const child = spawn(process.execPath, args, { stdio:['ignore','pipe','pipe'] });
    let out = '', err = '';
    child.stdout.on('data', d => out += d.toString());
    child.stderr.on('data', d => err += d.toString());
    child.on('close', (code) => {
      const dur = (performance.now() - t0) / 1000;
      resolve({ code, seconds: dur, stdout: out.trim(), stderr: err.trim() });
    });
  });
}

(async function main(){
  const a = parseArgs(process.argv);
  if (!a.input.length) a.input = ['./tests/fixtures/test-cases-full.json','./tests/fixtures'];
  const table = [];
  for (const p of a.par){
    const runs = [];
    for (let r=0;r<a.runs;r++){
      const res = await runSuiteOnce({
        suite: a.suite, input: a.input, langs: a.langs,
        ai: a.ai, seed: a.seed, dedup: a.dedup, report: a.report,
        assertLang: a.assertLang, ignoreCaseLang: a.ignoreCaseLang,
        sheets: a.sheets, lexicon: a.lexicon, limit: a.limit, truncate: a.truncate,
        parallel: p
      });
      runs.push(res);
      const status = res.code===0 ? 'ok' : 'no';
      console.log(`[autotune] par=${p} run=${r+1}/${a.runs} time=${res.seconds.toFixed(2)}s code=${res.code} OK=${status}`);
      if (res.code!==0 && res.stderr) console.error(`[autotune][stderr] par=${p} →\n${res.stderr}\n`);
    }
    const best = Math.min(...runs.map(x=>x.seconds));
    const avg = runs.reduce((s,x)=>s+x.seconds,0)/runs.length;
    const ok = runs.every(x=>x.code===0) ? 'yes' : 'no';
    table.push({ parallel: p, best, avg, ok });
  }

  // Summary
  console.log(`\nAutotune results (ai=${a.ai}, runs=${a.runs}, limit=${a.limit}, truncate=${a.truncate})`);
  console.log(`parallel\tbest\t\tavg\t\tOK`);
  for (const row of table){
    console.log(`${row.parallel}\t${row.best.toFixed(2)} s\t${row.avg.toFixed(2)} s\t${row.ok}`);
  }
  const candidates = table.filter(t=>t.ok==='yes').sort((x,y)=>x.avg-y.avg);
  const pick = (candidates[0]||table.sort((x,y)=>x.avg-y.avg)[0]);
  console.log(`\nSuggested --parallel=${pick.parallel} (avg=${pick.avg.toFixed(2)} s, best=${pick.best.toFixed(2)} s)`);
})().catch(e=>{ console.error('[autotune] fatal:', e); process.exit(1); });
