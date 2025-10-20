import dotenv from 'dotenv';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// --- Force-load /tests/.env and protect it from being overwritten ---
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testEnvPath = path.join(__dirname, '.env');

dotenv.config({ path: testEnvPath, override: true });
process.env.DOTENV_CONFIG_PATH = testEnvPath;
process.env.NODE_ENV = 'test';

console.log('[dotenv] forced test env loaded:', testEnvPath);
console.log('FAQ_SHEETS_OFFLINE_CACHE =', process.env.FAQ_SHEETS_OFFLINE_CACHE);

// ESM-only adapter layer to match Super-torture-suite.mjs expectations
// This file does NOT modify domain logic. It thin-wraps existing /lib modules
// to provide stable symbols: runGates, detectLang, faqLookup, ask, and logger.

// ---- Gates/Filters adapter -------------------------------------------------
// We don't have a gates runner in /lib, so this adapter reads /config JSONs
// and applies a minimal, test-only policy (NO domain logic changes).
import { readFile as _readFile } from 'node:fs/promises';

async function readJson(p){ try{ const txt=await _readFile(p,'utf8'); return JSON.parse(txt);}catch{ return null; } }
async function loadConfigs(){
  const root = process.cwd();
  const cfgDir = path.resolve(root, 'config');
  const gates = await readJson(path.join(cfgDir, 'gates.json')) || {};
  const keywords = await readJson(path.join(cfgDir, 'keywords.json')) || {};
  const block = await readJson(path.join(cfgDir, 'blocklists.json')) || {};
  const allow = await readJson(path.join(cfgDir, 'allowlists.json')) || {};
  return { gates, keywords, block, allow };
}
export async function runGates({ text, lang }){
  const { block, allow } = await loadConfigs();
  const t = String(text||'').toLowerCase();
  const blocks = new Set([...(block?.global||[]), ...ensureArray(block?.[lang]||[])].map(x=>String(x).toLowerCase()))
  for (const b of blocks){ if (b && t.includes(b)) return { allowed:false, reason:`blocked:${b}` } }
  const allows = new Set([...(allow?.global||[]), ...ensureArray(allow?.[lang]||[])].map(x=>String(x).toLowerCase()))
  for (const a of allows){ if (a && t.includes(a)) return { allowed:true, reason:`allow:${a}` } }
  return { allowed:true };
}

// ---- Language detection adapter -------------------------------------------
import { detectLangCore } from '../../lib/detect-lang-core.js';
export async function detectLang(text) {
  const r = await detectLangCore({ text });
  const lang = r?.lang || r?.language || r?.result?.lang || r?.result?.language;
  if (typeof lang === 'string') return lang.toUpperCase();
  const scores = r?.scores || r?.result?.scores;
  if (scores && typeof scores === 'object') {
    const best = Object.entries(scores).sort((a,b)=> (b[1]||0)-(a[1]||0))[0]?.[0];
    if (best) return String(best).toUpperCase();
  }
  return 'SE';
}

// ---- FAQ lookup adapter ----------------------------------------------------
import { initFaqData, getFaqIndex } from '../../lib/faq-data.js';
let faqInitOnce = false;
export async function faqLookup({ text, lang, topN = 5 }) {
  if (!faqInitOnce) { await initFaqData('torture-suite'); faqInitOnce = true; }
  const idx = await getFaqIndex(lang);
  if (!idx || typeof idx.search !== 'function') return { hit: false, candidates: [] };
  const results = idx.search(text, { limit: topN });
  const candidates = (results||[]).map(r => ({
    id: r.item?.id ?? r.item?.faqId ?? r.refIndex ?? r.item?.rowId ?? null,
    score: typeof r.score === 'number' ? (1 - r.score) : (r.score || 0),
    title: r.item?.question || r.item?.q || r.item?.title,
    answer: r.item?.answer || r.item?.a || r.item?.body,
    raw: r,
  }));
  return { hit: candidates.length > 0, candidates };
}

// ---- OpenAI client adapter (optional) -------------------------------------
import { getOpenAIClient } from '../../lib/openai-client.js';
let _client;
export async function ask({ text, lang, contextFaqs = [] }) {
  if (!_client) _client = await getOpenAIClient('torture-suite');
  if (_client?.ask && typeof _client.ask === 'function') {
    return await _client.ask({ text, lang, contextFaqs });
  }
  if (_client?.chat && typeof _client.chat === 'function') {
    return await _client.chat({ text, lang, contextFaqs });
  }
  if (_client?.responses?.create && typeof _client.responses.create === 'function') {
    const prompt = buildPrompt(text, lang, contextFaqs);
    const res = await _client.responses.create({ input: prompt });
    const answer = res?.output_text || res?.content?.[0]?.text || '';
    return { answer, tokensIn: res?.usage?.input_tokens, tokensOut: res?.usage?.output_tokens };
  }
  throw new Error('OpenAI client does not expose ask/chat/responses.create; please provide a wrapper.');
}
function buildPrompt(text, lang, contextFaqs){
  const pre = contextFaqs.slice(0,5).map((c,i)=>`Q${i+1}:${c.title}\nA${i+1}:${(c.answer||'').slice(0,400)}`).join('\n');
  return `Language:${lang}\nContext:\n${pre}\n---\nUser:${text}\nAnswer in the same language.`;
}

// ---- Logger adapter --------------------------------------------------------
import { logMessage } from '../../lib/logger.js';
const logFile = 'torture-suite.log';
const logger = {
  info: (...a) => logMessage(logFile, a.join(' ')),
  warn: (...a) => logMessage(logFile, '[WARN] ' + a.join(' ')),
  error: (...a) => logMessage(logFile, '[ERROR] ' + a.join(' ')),
};
export default logger;
