/* global fetch, AbortSignal */
import { createHash } from 'node:crypto';
import { Buffer } from 'node:buffer';
import { URL } from 'node:url';
import { TextDecoder } from 'node:util';
import { load } from 'cheerio';
import { commercialFact } from './knowledge-policy.js';
import { warrantyMaterial } from './warranty-policy.js';
const HOSTS = new Set(['klinkerdack.se', 'www.klinkerdack.se']);
export function publicSiteUrl(value) {
  try {
    const u = new URL(value);
    const p = decodeURIComponent(u.pathname);
    if (u.protocol !== 'https:' || !HOSTS.has(u.hostname) || u.port || u.username || u.password || u.search
      || /%2f|%5c|%25|\\|\/\/|(?:^|\/)\.{1,2}(?:\/|$)/iu.test(u.pathname)
      || /(?:^|\/)(?:admin|__sys__|api|search|checkout|cart|kundvagn|account|customer|login|logout|newsletter[^/]*)(?:\/|\.|$)/iu.test(p)) return null;
    u.hash = ''; return u.href;
  } catch { return null; }
}
const norm = s => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
function ratingEntity(question) {
  const full = norm(question);
  // Keep identity exact while accepting conversational preambles and attribution.
  const last = question.split(/[.!?]/u).map(s=>s.trim()).filter(Boolean).at(-1) || question;
  const q = norm(last).replace(/ (?:enligt (?:er |eran |erans )?(?:hemsida|produktsida|produktsidan)|anges pa (?:er )?hemsida)$/u,'');
  const named = full.match(/(?:tittar pa|funderar pa|valjer|gillar) (.+?)(?: runt poolen)? (?:vilken|vad) /u);
  for (const pattern of [
    /^(?:vilken|hvilken) (?:r klassning|r klass|r klasse|halkklassning|skridsikkerhedsklasse) har (.+)$/u,
    /^welche (?:r klasse|rutschhemmungsklasse) hat (.+)$/u,
    /^what (?:r class|r rating|slip rating) does (.+) have$/u,
    /^what (?:r class|r rating|slip rating) is (.+)$/u,
    /^(.+?) (?:r klassning|r klass|r klasse|r class|r rating)$/u,
    /^(?:r klassning|r klass|halkklassning) (?:for )?(.+)$/u,
  ]) { const m = q.match(pattern); if (m) {
    if (!/^(?:den|det|denna|den har|vilken|hvilken|what)$/u.test(m[1])) return m[1];
    return named?.[1] || null;
  } }
  if(/r klass|halkklass/u.test(full))return named?.[1] || null;
  return null;
}
export function ratingQuestion(question) { return ratingEntity(question) !== null; }
export function ratingLookupQuestion(question, conversation=[]) {
  const entity=ratingEntity(question);
  if(entity) return `Vilken R-klassning har ${entity}?`;
  if(!/(?:r[- ]?klass|r[- ]?rating|halkklass)/iu.test(question))return null;
  // Only explicit customer product names may resolve a pronoun, never a prior
  // model answer. Candidate identity is still checked against the live sitemap.
  if(/\b(?:den|det|it|that)\b/iu.test(question)) {
    for(const turn of [...conversation].reverse().filter(t=>t.role==='user')) {
      const previous=ratingEntity(turn.content);
      if(previous)return `Vilken R-klassning har ${previous}?`;
    }
  }
  return null;
}
export function parseRobots(text) {
  let applies = false;
  const disallow = [], sitemaps = [];
  for (const raw of text.split(/\r?\n/u)) {
    const [key, ...rest] = raw.split('#')[0].split(':');
    const value = rest.join(':').trim();
    if (key.trim().toLowerCase() === 'user-agent') applies = value === '*' || /prontofaqbot/iu.test(value);
    if (applies && key.trim().toLowerCase() === 'disallow' && value) disallow.push(value);
    if (key.trim().toLowerCase() === 'sitemap' && publicSiteUrl(value) && !/image/iu.test(value)) sitemaps.push(value);
  }
  return { disallow, sitemaps };
}
const allowedByRobots = (url, robots) => !robots.disallow.some(rule => {
  const escaped = rule.replace(/[.+?^${}()|[\]\\]/gu, '\\$&').replace(/\*/gu, '.*');
  return new RegExp('^' + escaped, 'u').test(new URL(url).pathname);
});
async function boundedText(response, limit = 800000) {
  const reader = response.body.getReader();
  const chunks = []; let size = 0;
  try {
    for (;;) { const {done,value} = await reader.read(); if (done) break; size += value.length;
      if (size > limit) throw Error('Oversized source'); chunks.push(Buffer.from(value)); }
  } finally { await reader.cancel(); }
  const bytes = Buffer.concat(chunks);
  const hint = (response.headers.get('content-type') || '') + ' ' + bytes.subarray(0, 4000).toString('ascii');
  const latin = /charset\s*=\s*["']?(?:iso-8859-1|windows-1252)/iu.test(hint);
  return new TextDecoder(latin ? 'windows-1252' : 'utf-8', {fatal:true}).decode(bytes);
}
export function verifiedWebsiteFact(row, now = Date.now()) {
  const e = row?.evidence, age = now - Date.parse(e?.checkedAt);
  return e?.origin === 'website' && e.approvalStatus === 'site-published'
    && e.factClass === 'static' && publicSiteUrl(e.source) === e.source
    && typeof e.sourceId === 'string' && e.sourceId.startsWith(e.source + '#')
    && typeof e.version === 'string' && /^[a-f0-9]{64}$/u.test(e.version)
    && Number.isFinite(age) && age >= -5000 && age < 300000;
}
export function extractWebsiteFacts(html, url, question, checkedAt = new Date().toISOString()) {
  if (!publicSiteUrl(url)) return {status:'unavailable'};
  const $ = load(html);
  $('script,style,nav,header,footer,iframe,noscript,button,[hidden],[aria-hidden="true"]').remove();
  const title = $('h1').first().text().trim();
  if (!title) return {status:'unavailable'};
  const entity = ratingEntity(question);
  const version = createHash('sha256').update(html).digest('hex');
  const evidence = {sourceId:url+'#content',source:url,location:'Public page content',date:checkedAt,
    checkedAt,version,origin:'website',approvalStatus:'site-published',factClass:'static'};
  if (entity !== null) {
    // Require exact full product identity. Never borrow a neighbour/Pro/format variant.
    if (norm(title).replace(/^uteklinker /u,'') !== entity) return {status:'ambiguous'};
    const ratings = new Set();
    const variants = $('.specifikation-hela-rutan .product-specs-table');
    let incomplete = !variants.length;
    variants.each((_, variant) => {
      const surface = $(variant).find('.ml-variant-vtext-row').filter((_, el) => $(el).find('.ml-variant-vtext-title').text().trim() === 'Yta:');
      if (surface.length !== 1) { incomplete = true; return; }
      surface.each((_, el) => {
      const label = $(el).find('.ml-variant-vtext-title').text().trim();
      if (label !== 'Yta:') return;
      const text = $(el).text().slice(label.length).trim();
      const matches = text.match(/\bR(?:9|10|11|12|13)\b/gu) || [];
      if (matches.length === 1) ratings.add(matches[0]); else incomplete = true;
      });
    });
    if (incomplete || ratings.size !== 1) return {status:'ambiguous'};
    return {status:'ready',title,rating:[...ratings][0],url,rows:[{question,answer:[...ratings][0],evidence:{...evidence,location:'Information / Yta (all published variants)'}}]};
  }
  // General pages remain bounded, cited context; never ingest a whole page as instructions.
  $('form').remove();
  const words = norm(question).split(' ').filter(w => w.length >= 5);
  const titleWords = norm(title).split(' ').filter(w => w.length >= 5);
  if (titleWords.filter(w => words.includes(w)).length < 2) return {status:'unavailable'};
  const snippets = [];
  $('main p, article p, .produktbeskrivning p').each((_, el) => {
    const text = $(el).text().replace(/\s+/gu,' ').trim();
    if (text.length < 30 || text.length > 1500 || commercialFact.test(text) || warrantyMaterial(text)
      || /ignore.{0,30}instructions|system prompt|developer message/iu.test(text)) return;
    if (words.some(w => norm(text).split(' ').includes(w))) snippets.push(text);
  });
  if (!snippets.length) return {status:'unavailable'};
  return {status:'ready',title,url,rows:[{question,answer:[...new Set(snippets)].slice(0,3).join('\n').slice(0,3000),evidence}]};
}
export function extractPublicContext(html,url,checkedAt=new Date().toISOString()) {
  if(!publicSiteUrl(url)) return [];
  const $=load(html);
  $('script,style,nav,header,footer,iframe,noscript,form,button,[hidden],[aria-hidden="true"]').remove();
  const title=$('h1').first().text().replace(/\s+/gu,' ').trim();
  if(!title || title.length>180) return [];
  const version=createHash('sha256').update(html).digest('hex'), rows=[];
  // Do not flatten variant tables: that could assign a neighbour's rating or
  // dimensions to the requested SKU. Those have dedicated verified adapters.
  $('main p, article p, .produktbeskrivning p, .product-description p').each((index,el)=>{
    const text=$(el).text().replace(/\s+/gu,' ').trim();
    if(rows.length>=5 || text.length<30 || text.length>1200 || commercialFact.test(text) || warrantyMaterial(text)
      || /ignore.{0,30}instructions|system prompt|developer message|disregard|ignorera.{0,30}instruktion/iu.test(text)) return;
    rows.push({question:title,answer:text,evidence:{sourceId:url+'#paragraph-'+index,source:url,
      location:'Public page / '+title+' / paragraph '+index,date:checkedAt,checkedAt,version,
      origin:'website',approvalStatus:'site-published',factClass:'static'}});
  });
  return rows;
}
export function createWebsiteLookup({fetcher=fetch,clock=Date.now}={}) {
  let index, loadedAt=0, pending;
  async function read(url, robots) {
    let current = publicSiteUrl(url);
    for (let redirects=0; current && redirects<=2; redirects++) {
      if (robots && !allowedByRobots(current,robots)) throw Error('Disallowed source');
      const response = await fetcher(current,{method:'GET',redirect:'manual',credentials:'omit',cache:'no-store',
        headers:{Accept:'text/html, application/xml, text/plain','User-Agent':'ProntoFAQBot/1.0'},signal:AbortSignal.timeout(5000)});
      if ([301,302,303,307,308].includes(response.status)) {
        const location=response.headers.get('location'); current=location?publicSiteUrl(new URL(location,current).href):null; continue;
      }
      if (!response.ok || !/text\/(?:html|plain)|(?:application|text)\/xml/iu.test(response.headers.get('content-type')||'')) throw Error('Unavailable source');
      return {text:await boundedText(response),url:current};
    }
    throw Error('Unsafe redirect');
  }
  async function getIndex() {
    if (index && clock()-loadedAt<900000) return index;
    if (!pending) pending=(async()=>{
      const robots=parseRobots((await read('https://klinkerdack.se/robots.txt')).text);
      const queue=robots.sitemaps.slice(0,2),seen=new Set(),urls=new Set();
      if (!queue.length) throw Error('No advertised sitemap');
      while(queue.length && seen.size<4) {
        const next=queue.shift();if(seen.has(next))continue;seen.add(next);
        const xml=(await read(next,robots)).text;
        const $=load(xml,{xmlMode:true});
        $('loc').each((_,el)=>{const u=publicSiteUrl($(el).text().trim()); if(!u)return;
          if($('sitemapindex').length) {if(queue.length<4)queue.push(u);}
          else if(urls.size<5000&&allowedByRobots(u,robots))urls.add(u);});
      }
      if (!urls.size) throw Error('Empty sitemap');
      index={urls:[...urls],robots};loadedAt=clock();return index;
    })().finally(()=>{pending=null;});
    return pending;
  }
  async function lookup({question,lang='SE',env=process.env}={}) {
    if (env.WEBSITE_KNOWLEDGE_ENABLED!=='true' || env.VERCEL_ENV!=='preview') return {status:'disabled'};
    try {
      const data=await getIndex();
      const entity=ratingEntity(question);
      let candidates;
      if(entity!==null) candidates=data.urls.filter(u=>norm(new URL(u).pathname.replace(/^\/uteklinker-/u,''))===entity);
      else {
        const words=norm(question).split(' ').filter(w=>w.length>=5);
        candidates=data.urls.map(url=>({url,score:words.filter(w=>norm(new URL(url).pathname).split(' ').includes(w)).length}))
          .filter(r=>r.score>=2).sort((a,b)=>b.score-a.score);
        if(candidates[1]?.score===candidates[0]?.score)return {status:'ambiguous'};
        candidates=candidates.slice(0,1).map(r=>r.url);
      }
      if(candidates.length!==1)return {status:'unavailable'};
      const page=await read(candidates[0],data.robots);
      const result=extractWebsiteFacts(page.text,page.url,question,new Date(clock()).toISOString());
      if(result.rating)result.reply={SE:`Enligt produktsidan för ${result.title} anges ytan som ${result.rating}/Antislip.`,DA:`Ifølge produktsiden for ${result.title} er overfladen angivet som ${result.rating}/Antislip.`,DE:`Laut Produktseite für ${result.title} ist die Oberfläche als ${result.rating}/Antislip angegeben.`,EN:`The product page for ${result.title} lists the surface as ${result.rating}/Antislip.`}[lang]||null;
      return result;
    } catch { return {status:'unavailable'}; }
  }
  lookup.search=async function search({query,lang='SE',env=process.env}={}) {
    if(env.WEBSITE_KNOWLEDGE_ENABLED!=='true' || env.VERCEL_ENV!=='preview') return {status:'disabled'};
    if(typeof query!=='string' || !query.trim() || query.length>300) return {status:'unavailable'};
    // Keep exact product identity and cross-variant consistency for R ratings.
    if(ratingQuestion(query)) return lookup({question:query,lang,env});
    try {
      const data=await getIndex();
      const stop=new Set(['och','eller','har','för','som','vad','hur','vilken','vilka','klinkerdack','www','https']);
      const terms=[...new Set(norm(query).split(' ').filter(w=>w.length>=3 && !stop.has(w)))].slice(0,10);
      if(!terms.length) return {status:'unavailable'};
      const ranked=data.urls.map(url=>({url,score:terms.filter(w=>norm(new URL(url).pathname).split(' ').some(t=>t===w || t.startsWith(w) && w.length>=5)).length}))
        .filter(r=>r.score>0).sort((a,b)=>b.score-a.score || a.url.localeCompare(b.url)).slice(0,2);
      const pages=await Promise.allSettled(ranked.map(async r=>{
        const page=await read(r.url,data.robots);
        return extractPublicContext(page.text,page.url,new Date(clock()).toISOString());
      }));
      const rows=pages.flatMap(r=>r.status==='fulfilled'?r.value:[]).slice(0,6);
      return {status:rows.length?'ready':'unavailable',rows};
    } catch {return {status:'unavailable'};}
  };
  return lookup;
}
export const lookupWebsite = createWebsiteLookup();
