// /tests/utils/patch-faq-sheets.mjs
// TEST-ONLY shim that rate-limits Google Sheets reads and falls back to local cache if quota is exceeded.
// It monkey-patches functions from /lib/faq-sheets.js at runtime. No domain logic changes.
//
// Usage in suite (before initFaqData):
//   import './utils/patch-faq-sheets.mjs';
//
// Env (optional):
//   FAQ_SHEETS_READ_MAX_RPM=20      // max read calls per minute
//   FAQ_SHEETS_READ_RETRIES=3       // retry on quota exceeded
//   FAQ_SHEETS_READ_BACKOFF_MS=15000// backoff between retries
//   FAQ_SHEETS_OFFLINE_CACHE=./tests/fixtures/faq-cache  // directory with per-lang JSON dumps
//
// Fallback file naming (looked up in OFFLINE_CACHE):
//   <OFFLINE_CACHE>/<lang>_FULL_LOOKUP.json
//
// If a patched function throws quota error and offline file exists, it returns the offline data instead.

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { readFile } from 'node:fs/promises';

const ROOT = process.cwd();
const MOD = pathToFileURL(path.join(ROOT, './lib/faq-sheets.js')).href;

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
const MAX_RPM = Math.max(1, parseInt(process.env.FAQ_SHEETS_READ_MAX_RPM||'20',10)||20);
const RETRIES = Math.max(0, parseInt(process.env.FAQ_SHEETS_READ_RETRIES||'3',10)||3);
const BACKOFF = Math.max(1000, parseInt(process.env.FAQ_SHEETS_READ_BACKOFF_MS||'15000',10)||15000);
const OFFLINE = path.resolve(ROOT, process.env.FAQ_SHEETS_OFFLINE_CACHE||'./tests/fixtures/faq-cache');

let calls = [];
function canCall(){
  const now = Date.now();
  // drop events older than 60s
  calls = calls.filter(t => now - t < 60000);
  return calls.length < MAX_RPM;
}
async function gate(){
  while (!canCall()){
    // wait until one call falls out of the window
    const now = Date.now();
    const head = calls[0];
    const wait = Math.max(10, 60010 - (now - head));
    await sleep(wait);
  }
  calls.push(Date.now());
}

function isQuotaError(e){
  const msg = (e && (e.message || e.toString())) || '';
  return /quota.*exceed|Read requests per minute/i.test(msg);
}

async function readOffline(kind){
  // kind e.g. "SE_FULL_LOOKUP"
  try{
    const f = path.join(OFFLINE, `${kind}.json`);
    const t = await readFile(f, 'utf8');
    return JSON.parse(t);
  } catch {
    return null;
  }
}

function wrapRead(fnName){
  return async function wrapped(...args){
    let lastErr = null;
    for (let attempt=0; attempt<=RETRIES; attempt++){
      try {
        await gate();
        const res = await orig[fnName](...args);
        return res;
      } catch (e){
        lastErr = e;
        if (isQuotaError(e)){
          if (attempt < RETRIES){
            await sleep(BACKOFF);
            continue;
          }
          // Try offline fallback by inferring a key/kind from args
          const hint = String(args?.[0] || '').toUpperCase();
          const maybe = await readOffline(hint);
          if (maybe) return maybe;
        }
        throw e;
      }
    }
    throw lastErr;
  };
}

let orig = {};
(async function patch(){
  let mod;
  try { mod = await import(MOD); } catch { return; }
  // Copy originals
  for (const k of Object.keys(mod)){
    orig[k] = mod[k];
  }
  // Patch commonly used read-ish functions if present
  const candidates = ['loadAllLookups','read','readSheet','readRange','getAll','getFullLookup'];
  for (const name of candidates){
    if (typeof mod[name] === 'function'){
      mod[name] = wrapRead(name);
    }
  }
  // Expose back status (optional)
  globalThis.__FAQ_SHEETS_SHIM__ = {
    rpm: MAX_RPM, retries: RETRIES, backoffMs: BACKOFF, offlineDir: OFFLINE
  };
})().catch(()=>{});
