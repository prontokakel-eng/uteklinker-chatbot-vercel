/* global fetch, AbortSignal, TextDecoder, URL, URLSearchParams */
import { createHash } from 'node:crypto';
import { load } from 'cheerio';
import { publicSiteUrl, parseRobots, verifiedWebsiteFact } from './website-knowledge.js';
import { commercialFact } from './knowledge-policy.js';
import { warrantyMaterial } from './warranty-policy.js';
const ORIGIN = 'https://klinkerdack.se';
const CATEGORY = ORIGIN + '/uteklinker';
const hash = value => createHash('sha256').update(value).digest('hex');
const norm = value => value.normalize('NFKC').trim().toLocaleLowerCase();
const size = text => {
  const m = text.match(/^(\d{1,3}(?:[.,]\d)?)\s*[x×–−-]\s*(\d{1,3}(?:[.,]\d)?)(?:\s*(?:cm))?$/u);
  return m && m.slice(1).every(n => Number(n.replace(',', '.')) > 0 && Number(n.replace(',', '.')) <= 300)
    ? m.slice(1).map(n => Number(n.replace(',', '.'))).sort((a,b) => a-b).join(' × ') : null;
};
const styleLabels = {stenkänsla:'Stenkänsla',stenlook:'Stenkänsla',Steinoptik:'Stenkänsla','stone look':'Stenkänsla',betongkänsla:'Betongkänsla',betonlook:'Betongkänsla',Betonoptik:'Betongkänsla','concrete look':'Betongkänsla',träkänsla:'Träkänsla',trælook:'Träkänsla',Holzoptik:'Träkänsla','wood look':'Träkänsla'};
export function extractCatalogFilters(html) {
  // Read the site's published filter controls without executing any scripts.
  const controls = [...html.matchAll(/value="([^"<>]{1,80})" id="filter_(\d{1,5})_(\d{1,8})"/gu)]
    .map(([,label,group,id]) => ({label,group,id}));
  const category = html.match(/postparams\['category_id'\]='(\d{1,8})'/u)?.[1];
  return {controls,category};
}
export function extractProductFormats(html, url, checkedAt = new Date().toISOString()) {
  if (!publicSiteUrl(url)) return null;
  const $ = load(html);
  $('script,style,nav,header,footer,iframe,noscript,[hidden],[aria-hidden="true"]').remove();
  const title = $('h1').first().text().replace(/\s+/gu,' ').trim();
  if (!/^Uteklinker /iu.test(title) || title.length > 150 || commercialFact.test(title) || warrantyMaterial(title)) return null;
  const formats = new Set();
  $('.specifikation-hela-rutan .product-specs-table').each((_, table) => {
    const fields = {};
    $(table).find('.ml-variant-vtext-row').each((_,row) => {
      const label = $(row).find('.ml-variant-vtext-title').text().trim();
      if (Object.hasOwn(fields,label)) fields[label] = ''; // Conflicting field: fail closed.
      else { const value=$(row).clone(); value.find('.ml-variant-vtext-title').remove(); fields[label]=value.text().trim(); }
    });
    if (/poolkant|trappsteg|varuprov/iu.test(Object.values(fields).join(' '))) return;
    const nominal = fields['Nominell storlek:']?.match(/^(\d{1,3}(?:[.,]\d)?)\s*x\s*(\d{1,3}(?:[.,]\d)?)\s*x\s*2\s*cm$/iu);
    if (!nominal) return;
    const format = size(nominal[1]+'x'+nominal[2]); if (format) formats.add(format);
  });
  if (!formats.size) return null;
  return {title,url,formats:[...formats],evidence:{sourceId:url+'#formats',source:url,location:'Information / Nominell storlek (20 mm floor variants; excludes samples, coping and steps)',date:checkedAt,checkedAt,version:hash(html),origin:'website',approvalStatus:'site-published',factClass:'static'}};
}
async function boundedHtml(response) {
  const reader = response.body.getReader(); const chunks=[]; let bytes=0;
  try { for (;;) { const {done,value}=await reader.read(); if(done) break; bytes+=value.length; if(bytes>800000) throw Error('Oversized catalog response');chunks.push(value); } } finally { await reader.cancel(); }
  const buffer = new Uint8Array(bytes); let offset=0;for(const chunk of chunks){buffer.set(chunk,offset);offset+=chunk.length;}
  const hint = (response.headers.get('content-type') || '') + ' ' + new TextDecoder('ascii').decode(buffer.slice(0,4000));
  return new TextDecoder(/charset\s*=\s*["']?(?:iso-8859-1|windows-1252)/iu.test(hint)?'windows-1252':'utf-8',{fatal:true}).decode(buffer);
}
export function verifiedProductSelection(result, now = Date.now()) {
  return result?.status === 'ready' && result.products?.length > 0 && result.products.length <= 3
    && result.products.every(p => verifiedWebsiteFact({evidence:p.evidence},now) && p.url === p.evidence.source
      && typeof p.title === 'string' && p.title.length <= 150 && p.formats?.length > 0 && p.formats.every(f => size(f) === f))
    && verifiedWebsiteFact({evidence:result.classificationEvidence},now);
}
export function createProductDiscovery({fetcher=fetch,clock=Date.now}={}) {
  let metadata, pending;
  async function read(url, options={}) {
    // Only public fixed catalog POST and allowlisted product/robots GET. No user
    // question, browser cookies or credentials are ever sent to the shop.
    let current=publicSiteUrl(url);
    for(let redirects=0;current && redirects<=2;redirects++) {
      const response=await fetcher(current,{method:'GET',...options,redirect:'manual',credentials:'omit',cache:'no-store',headers:{Accept:'text/html,text/plain','User-Agent':'ProntoFAQBot/1.0',...(options.headers||{})},signal:AbortSignal.timeout(5000)});
      if([301,302,303,307,308].includes(response.status)) {
        if(options.method === 'POST') throw Error('Catalog POST redirect rejected');
        current=publicSiteUrl(new URL(response.headers.get('location')||'',current).href);continue;
      }
      if(!response.ok || !/text\/(?:html|plain)/iu.test(response.headers.get('content-type')||'')) throw Error('Unavailable catalog');
      return {html:await boundedHtml(response),url:current};
    }
    throw Error('Unsafe catalog URL');
  }
  async function getMetadata() {
    if(metadata && clock()-metadata.time<300000) return metadata;
    if(!pending) pending=(async()=>{
      const robots=parseRobots((await read(ORIGIN+'/robots.txt')).html);
      const allowed = url => !robots.disallow.some(rule=>new URL(url).pathname.startsWith(rule.replace(/\*$/u,'')));
      if(!allowed(CATEGORY) || !allowed(ORIGIN+'/')) throw Error('Catalog disallowed');
      const page=await read(CATEGORY);const filters=extractCatalogFilters(page.html);
      if(!filters.category || !filters.controls.length) throw Error('No published filters');
      metadata={...filters,time:clock(),allowed,evidence:{sourceId:CATEGORY+'#filters',source:CATEGORY,location:'Published colour and appearance filter controls',date:new Date(clock()).toISOString(),checkedAt:new Date(clock()).toISOString(),version:hash(page.html),origin:'website',approvalStatus:'site-published',factClass:'static'}};
      return metadata;
    })().finally(()=>{pending=null;});
    return pending;
  }
  return async function discover({preferences,lang='SE',env=process.env}={}) {
    if(env.WEBSITE_KNOWLEDGE_ENABLED!=='true' || env.VERCEL_ENV!=='preview') return {status:'disabled'};
    const requested=size(preferences?.format||'');const style=styleLabels[preferences?.style];
    if(!requested || (!style && !preferences?.grey)) return {status:'incomplete'};
    try {
      const meta=await getMetadata();
      const control = label => {const matches=meta.controls.filter(c=>norm(c.label)===norm(label));if(matches.length!==1)throw Error('Ambiguous filter');return matches[0];};
      const required=[...(preferences.grey?[control('Grå')]:[]),...(style?[control(style)]:[])];
      const formatControl=meta.controls.find(c=>size(c.label)===requested);
      async function candidates(includeFormat) {
        const controls=includeFormat?[...required,formatControl]:required;
        const body=new URLSearchParams({RUN_INCLUDE:'rs/rs-filter-products.htm',FORCE_POST_CHARSET:'utf-8',category_id:meta.category,Pagenum:'1',Pagerows:'20',show_numfilterproducts:'20',product_small_template:'vertical-small',filter_options:controls.map(c=>'||'+c.group+'|'+c.id).join(''),saved_request_page:'/category.html/uteklinker'}).toString();
        const listing=await read(ORIGIN+'/',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body});
        const $=load(listing.html);const urls=new Set();
        $('.product-small-name a[rel="product"]').each((_,a)=>{const u=publicSiteUrl(new URL($(a).attr('href'),ORIGIN).href);if(u && meta.allowed(u))urls.add(u);});
        return {urls:[...urls].slice(0,6),evidence:{...meta.evidence,sourceId:CATEGORY+'#filtered-products',location:'Published catalog filter results: '+controls.map(c=>c.label).join(', '),checkedAt:new Date(clock()).toISOString(),date:new Date(clock()).toISOString(),version:hash(listing.html)}};
      }
      let list=formatControl?await candidates(true):{urls:[]};let exactSearch=!!list.urls.length;
      if(!list.urls.length) list=await candidates(false);
      const products=[];
      // Bounded public reads; do not crawl the entire site on a chat request.
      for(let offset=0;offset<list.urls.length;offset+=3) {
        const batch=await Promise.allSettled(list.urls.slice(offset,offset+3).map(async url=>{const p=await read(url);return extractProductFormats(p.html,p.url,new Date(clock()).toISOString());}));
        for(const r of batch) if(r.status==='fulfilled' && r.value && (!exactSearch || r.value.formats.includes(requested))) products.push(r.value);
        if(products.length>=3) break;
      }
      if(!products.length) return {status:'unavailable'};
      const exact=products.filter(p=>p.formats.includes(requested));
      const target=requested.split(' × ').map(Number);
      const distance=f=>f.split(' × ').map(Number).reduce((sum,n,i)=>sum+Math.abs(Math.log(n/target[i])),0);
      for(const product of products) product.formats.sort((a,b)=>distance(a)-distance(b));
      const chosen=(exact.length?exact:products.sort((a,b)=>distance(a.formats[0])-distance(b.formats[0]))).slice(0,3);
      const intro=exact.length?{
        SE:`Här är produkter som matchar dina önskemål och har ${requested} cm angivet på produktsidan:`,DA:`Her er produkter, der matcher dine ønsker og har ${requested} cm angivet på produktsiden:`,DE:`Diese Produkte passen zu Ihren Wünschen; ${requested} cm ist auf der Produktseite angegeben:`,EN:`These products match your preferences and list ${requested} cm on their product pages:`,
      }:{
        SE:`Jag kunde inte verifiera ${requested} cm bland de kontrollerade produkterna. Här är alternativ med samma valda utseende${preferences.grey?' och grå färg':''}, men i andra format:`,DA:`Jeg kunne ikke bekræfte ${requested} cm blandt de kontrollerede produkter. Her er alternativer med samme valgte stil${preferences.grey?' og grå farve':''}, men i andre formater:`,DE:`Bei den geprüften Produkten konnte ich ${requested} cm nicht bestätigen. Hier sind Alternativen mit derselben gewählten Optik${preferences.grey?' und grauer Farbe':''}, aber in anderen Formaten:`,EN:`I could not verify ${requested} cm among the products checked. Here are alternatives with the same selected look${preferences.grey?' and grey colour':''}, in other formats:`,
      };
      const descriptions=chosen.map(p=>p.title+' — '+(exact.length?[requested]:p.formats.slice(0,4)).join(', ')+' cm');
      const result={status:'ready',products:chosen,classificationEvidence:list.evidence,reply:intro[lang]+'\n\n'+descriptions.join('\n'),exact:!!exact.length};
      return verifiedProductSelection(result,clock())?result:{status:'unavailable'};
    } catch { return {status:'unavailable'}; }
  };
}
export const discoverProducts=createProductDiscovery();
