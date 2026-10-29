import test from 'node:test';
import assert from 'node:assert/strict';
import { createProductDiscovery, extractProductFormats, verifiedProductSelection } from '../lib/product-discovery.js';
import { createChatPipeline } from '../lib/chatPipeline.js';
const origin='https://klinkerdack.se';
const env={WEBSITE_KNOWLEDGE_ENABLED:'true',VERCEL_ENV:'preview'};
// Synthetic catalog only. Real shop pages and private FAQ are never committed.
const filters=`<script>postparams['category_id']='4';</script>
<input value="Grå" id="filter_1_11"><input value="Stenkänsla" id="filter_2_21"><input value="Träkänsla" id="filter_2_22"><input value="Betongkänsla" id="filter_2_23"><input value="60x60 cm" id="filter_3_31">`;
const product=(name,formats,extra='')=>`<h1>Uteklinker ${name}</h1><div class="specifikation-hela-rutan">${formats.map(f=>`<div class="product-specs-table"><div class="ml-variant-vtext-row">\n     <span class="ml-variant-vtext-title">Nominell storlek:</span> ${f}x2cm\n     </div><div class="ml-variant-vtext-row"><span class="ml-variant-vtext-title">Användningsområde:</span>Uteplats</div></div>`).join('')}${extra}</div>`;
function rig({exact=true,fail=false,format='60x60',clock=Date.now}={}){
 const calls=[];
 const fetcher=async(url,options)=>{
  calls.push({url,options});
  const response=text=>new Response(text,{headers:{'content-type':'text/html;charset=utf-8'}});
  if(url===origin+'/robots.txt')return new Response('User-agent: *\nDisallow: /admin/*',{headers:{'content-type':'text/plain'}});
  if(url===origin+'/uteklinker')return response(filters);
  if(options.method==='POST'){
   const data=new URLSearchParams(options.body);
   assert.equal(url,origin+'/');assert.equal(data.get('RUN_INCLUDE'),'rs/rs-filter-products.htm');assert.equal(data.get('category_id'),'4');
   const narrow=data.get('filter_options').includes('||3|31');
   return response(narrow&&!exact?'':`<li class="product-small"><div class="product-small-name"><a rel="product" href="/uteklinker-synthetic-look">Synthetic Look</a></div></li>`);
  }
  if(url===origin+'/uteklinker-synthetic-look') {if(fail)throw Error('Synthetic offline page');return response(product('Synthetic Look',[format,'100x100']));}
  throw Error('Unexpected public read');
 };
 return {calls,lookup:createProductDiscovery({fetcher,clock})};
}
test('exact preferences produce cited product links and never invoke AI or FAQ',async()=>{
 const r=rig();const preferences={grey:true,style:'stenkänsla',format:'60 × 60'};
 const selection=await r.lookup({preferences,env});assert.equal(verifiedProductSelection(selection),true);assert.equal(selection.exact,true);
 assert.match(selection.reply,/60 × 60/);assert.equal(selection.products[0].url,origin+'/uteklinker-synthetic-look');
 assert.equal(selection.products[0].evidence.approvalStatus,'site-published');assert.ok(selection.classificationEvidence.location.includes('Grå, Stenkänsla'));
 const chat=createChatPipeline({gate:async()=>({filtered:false}),catalog:a=>r.lookup({...a,env}),knowledge:async()=>{throw Error('must not call');},ai:async()=>{throw Error('must not call');}});
 const result=await chat({body:{text:'grå stenkänsla',lang:'SE',conversation:[{role:'user',content:'Vad bör jag tänka på när jag väljer uteklinker?'},{role:'user',content:'60x60'}]},headers:{}});
 assert.equal(result.via,'PRODUCTS');assert.equal(result.citations[0].kind,'product');assert.equal(result.factStatus,'website-observed');
 assert.doesNotMatch(result.reply,/pris|lager|leverans|garanti/iu);
 for(const {options}of r.calls){assert.equal(options.credentials,'omit');assert.equal(options.redirect,'manual');assert.equal(options.headers.Cookie,undefined);}
});
test('missing size relaxes format only, retaining the selected appearance and colour',async()=>{
 const r=rig({exact:false,format:'80x80'});const s=await r.lookup({preferences:{grey:true,style:'stenkänsla',format:'60 × 60'},env});
 assert.equal(s.exact,false);assert.match(s.reply,/80 × 80/);assert.match(s.reply,/bland de kontrollerade/);assert.match(s.reply,/grå färg/);
 const queries=r.calls.filter(c=>c.options.method==='POST').map(c=>new URLSearchParams(c.options.body).get('filter_options'));
 assert.deepEqual(queries,['||1|11||2|21||3|31','||1|11||2|21']);
});
test('non-empty filtered results without verified matching variants still try alternative sizes',async()=>{
 const r=rig({exact:true,format:'80x80'});
 const s=await r.lookup({preferences:{style:'wood look',colour:null,format:'60x60'},env});
 assert.equal(s.status,'ready');assert.equal(s.exact,false);assert.match(s.reply,/80 × 80/);
 const filters=r.calls.filter(c=>c.options.method==='POST').map(c=>new URLSearchParams(c.options.body).get('filter_options'));
 assert.deepEqual(filters,['||2|22||3|31','||2|22']);
});
test('wood look without requested size suggests other sizes of wood look, in all four languages',async()=>{
 const examples={SE:['träkänsla','Kunde'],DA:['trælook','bekræfte'],DE:['Holzoptik','bestätigen'],EN:['wood look','verify']};
 for(const [lang,[style]]of Object.entries(examples)){
  const r=rig({exact:false,format:'30x120'});const s=await r.lookup({preferences:{style,format:'60 × 60'},lang,env});
  assert.equal(s.status,'ready',lang);assert.equal(s.exact,false);assert.match(s.reply,/30 × 120/);assert.match(s.classificationEvidence.location,/Träkänsla/);
  assert.ok(r.calls.filter(c=>c.options.method==='POST').every(c=>new URLSearchParams(c.options.body).get('filter_options').includes('||2|22')));
 }
});
test('unpublished formats, samples and coping cannot be used as ordinary floor alternatives',()=>{
 const extra='<div class="product-specs-table"><div class="ml-variant-vtext-row"><span class="ml-variant-vtext-title">Nominell storlek:</span>60x60x2cm</div><div class="ml-variant-vtext-row"><span class="ml-variant-vtext-title">Användningsområde:</span>Poolkant / Trappsteg</div></div>';
 const p=extractProductFormats(product('Synthetic',["80x80"],extra),origin+'/uteklinker-synthetic');
 assert.deepEqual(p.formats,['80 × 80']);
 assert.equal(extractProductFormats(product('Synthetic',[]),origin+'/uteklinker-synthetic'),null);
 assert.equal(extractProductFormats(product('Synthetic',['60x60']), 'https://evil.test/a'),null);
});
test('Preview opt-in, stale sources and unavailable product pages fail closed',async()=>{
 const r=rig();for(const disabled of [{},{...env,VERCEL_ENV:'production'}])assert.equal((await r.lookup({preferences:{style:'stenkänsla',format:'60 × 60'},env:disabled})).status,'disabled');assert.equal(r.calls.length,0);
 const s=await r.lookup({preferences:{style:'stenkänsla',format:'60 × 60'},env});assert.equal(verifiedProductSelection(s,Date.now()+301000),false);
 assert.equal((await rig({fail:true}).lookup({preferences:{style:'stenkänsla',format:'60 × 60'},env})).status,'unavailable');
 s.products[0].url='https://evil.test/a';assert.equal(verifiedProductSelection(s),false);
});
test('blocked, commercial and warranty requests never trigger product searches',async()=>{
 let calls=0;const catalog=async()=>{calls++;throw Error('must not call');};
 const blocked=createChatPipeline({gate:async()=>({filtered:true}),catalog});
 assert.equal((await blocked({body:{text:'grå stenkänsla 60x60',lang:'SE'},headers:{}})).via,'FILTER');
 const chat=createChatPipeline({gate:async()=>({filtered:false}),catalog});
 for(const text of ['Vad kostar grå stenkänsla 60x60?','Hur många års garanti på grå stenkänsla 60x60?'])assert.equal((await chat({body:{text,lang:'SE'},headers:{}})).via,'CONTACT');
 assert.equal(calls,0);
});
test('catalog failure gives an honest fallback, never manufactured product claims',async()=>{
 const chat=createChatPipeline({gate:async()=>({filtered:false}),catalog:async()=>({status:'unavailable'}),ai:async()=>{throw Error('must not call');}});
 const result=await chat({body:{text:'grå stenkänsla 60x60',lang:'SE'},headers:{}});
 assert.equal(result.via,'GUIDANCE');assert.match(result.reply,/kunde inte verifiera/);assert.equal(result.citations[0].url,origin+'/uteklinker');
});
test('catalog POST redirects and ambiguous filter IDs cannot authorize unverified alternatives',async()=>{
 let posts=0;
 const fetcher=async(url,o)=>{
  if(url.endsWith('robots.txt'))return new Response('User-agent: *',{headers:{'content-type':'text/plain'}});
  if(url.endsWith('/uteklinker'))return new Response(filters,{headers:{'content-type':'text/html'}});
  posts++;return new Response('',{status:302,headers:{location:'https://evil.test/a'}});
 };
 const lookup=createProductDiscovery({fetcher});assert.equal((await lookup({preferences:{style:'stenkänsla',format:'60 × 60'},env})).status,'unavailable');assert.equal(posts,1);
});

test('product titles cannot smuggle warranty or commercial claims into recommendations',()=>{
 for(const title of ['Synthetic 20 års garanti','Synthetic pris 99 kr'])assert.equal(extractProductFormats(product(title,['60x60']),origin+'/uteklinker-synthetic'),null);
});

test('duplicate published classification controls stop the search rather than choosing an ID',async()=>{
 let posts=0;
 const fetcher=async(url,o)=>{
  if(o.method==='POST'){posts++;throw Error('ambiguous controls must not be submitted');}
  if(url.endsWith('robots.txt'))return new Response('User-agent: *',{headers:{'content-type':'text/plain'}});
  return new Response(filters+'<input value="Stenkänsla" id="filter_2_99">',{headers:{'content-type':'text/html;charset=utf-8'}});
 };
 assert.equal((await createProductDiscovery({fetcher})({preferences:{style:'stenkänsla',format:'60 × 60'},env})).status,'unavailable');assert.equal(posts,0);
});
