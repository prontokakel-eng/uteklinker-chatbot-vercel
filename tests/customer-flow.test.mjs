import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createChatPipeline } from '../lib/chatPipeline.js';
import { createKnowledgeCache, parseWorkbook } from '../lib/drive-knowledge.js';
import { createRateLimiter } from '../lib/rate-limiter.js';
import { gateMessage } from '../lib/gate.js';
import { contactState, getStoreContact, stockholmTime } from '../lib/store-contact.js';
const data = { SE:[{question:'Vilka färger finns i Lava?',answer:'Etna och Salina'}], EN:[{question:'What colors are in Lava?',answer:'Etna and Salina'}], DA:[], DE:[] };
const req=(text,extra={})=>({body:{text,lang:'SE',...extra},headers:{'x-forwarded-for':'192.0.2.1'}});
function rig(overrides={}) {
 let calls=0;
 const pipeline=createChatPipeline({gate:async()=>({filtered:false}),knowledge:async()=>({status:'ready',data}),ai:async()=>{calls++;return 'Förklaring';},...overrides});
 return {pipeline,calls:()=>calls};
}
test('async gate blocks before loading data or AI',async()=>{
 const r=rig({gate:async()=>{await Promise.resolve();return {filtered:true};},knowledge:()=>{throw Error('must not load');}});
 assert.equal((await r.pipeline(req('hej'))).via,'FILTER');assert.equal(r.calls(),0);
});
test('FAQ first, selected language, refinement and general fallback',async()=>{
 const r=rig();assert.equal((await r.pipeline(req('Vilka färger finns i Lava?'))).reply,'Etna och Salina');assert.equal(r.calls(),0);
 assert.equal((await r.pipeline(req('What colors are in Lava?',{lang:'EN'}))).reply,'Etna and Salina');
 assert.equal((await r.pipeline(req('Vilka färger finns i Lava?',{refine:true}))).via,'AI');
 assert.equal((await r.pipeline(req('Vad betyder granitkeramik?'))).via,'AI');assert.equal(r.calls(),2);
});
test('data error, empty language and AI failure are distinct',async()=>{
 assert.equal((await rig({knowledge:async()=>({status:'error'})}).pipeline(req('Hur bygger jag?'))).via,'DATA_ERROR');
 assert.equal((await rig().pipeline(req('Hvordan lægger jeg fliser?',{lang:'DA'}))).via,'DATA_EMPTY');
 assert.equal((await rig({ai:async()=>{throw Error();}}).pipeline(req('Vad betyder granitkeramik?'))).via,'AI_ERROR');
});
test('unknown shop facts in all languages go to contact without AI',async()=>{
 const r=rig();for(const q of ['Vad är priset?','What is the price?','Wie sind Ihre Öffnungszeiten?','Hvad er jeres åbningstider?'])assert.equal((await r.pipeline(req(q))).via,'CONTACT',q);assert.equal(r.calls(),0);
});
test('Danish price forms and contextual price requests require verified facts',async()=>{
 const r=rig({knowledge:async()=>({status:'ready',data:{...data,DA:[{question:'Hvilke farver findes i Lava?',answer:'Etna og Salina'}]}})});
 for(const text of ['Hvad er prisen på Lava?','Hvad er priserne på Lava?','Hvad koster Lava?','Ja tak, hvad er prisen på dem?']) {
  assert.equal((await r.pipeline(req(text,{lang:'DA',conversation:[{role:'user',content:'Hvilke farver findes i Lava?'},{role:'assistant',content:'Etna og Salina'}]}))).via,'CONTACT',text);
 }
 assert.equal(r.calls(),0);
});
test('similar price FAQs cannot authorize a different format or series',async()=>{
 const question='Hvad er prisen på Lava 60x60?';
 const r=rig({knowledge:async()=>({status:'ready',data:{...data,DA:[{question,answer:'Verified fixture price'}]}})});
 assert.equal((await r.pipeline(req(question,{lang:'DA'}))).reply,'Verified fixture price');
 for(const text of ['Hvad er prisen på Lava 90x90?','Hvad er prisen på Arena 60x60?']) {
  assert.equal((await r.pipeline(req(text,{lang:'DA'}))).via,'CONTACT',text);
 }
 assert.equal(r.calls(),0);
});
test('unsupported installation questions never produce AI recipes',async()=>{
 const r=rig();
 for(const q of ['Hur monterar man klinkerdäck på gräs?','Hvordan lægger jeg fliser på græs?','Wie verlege ich Fliesen auf Rasen?','How do I install tiles on grass?']) {
  assert.equal((await r.pipeline(req(q))).via,'CONTACT',q);
 }
 assert.equal(r.calls(),0);
});
test('client-supplied context cannot overwrite server-selected FAQ',async()=>{
 let context;await rig({ai:async a=>{context=a.context;return 'ok';}}).pipeline(req('Vilka färger finns i Lava?',{refine:true,faqAnswer:'fake',nearbyFaq:[{answer:'fake'}]}));assert.equal(context[0].answer,'Etna och Salina');
});
test('cache coalesces, updates after TTL and exposes refresh error',async()=>{
 let t=1000,loads=0,fail=false;
 const get=createKnowledgeCache({now:()=>t,ttlMs:100,retryMs:10,loader:()=>{loads++;if(fail)throw Error();return {data:{SE:[loads]}};}});
 await Promise.all([get(),get(),get()]);assert.equal(loads,1);t+=50;await get();assert.equal(loads,1);t+=60;assert.deepEqual((await get()).data.SE,[2]);
 fail=true;t+=110;assert.equal((await get()).status,'error');assert.equal((await get()).data,undefined);fail=false;t+=11;assert.equal((await get()).status,'ready');
});
test('rate limit resets and real gate counts greeting shortcuts',async()=>{
 let t=0;const limit=createRateLimiter({now:()=>t,limit:2});assert.equal((await limit('a')).limited,false);assert.equal((await limit('a')).limited,false);assert.equal((await limit('a')).limited,true);t=60001;assert.equal((await limit('a')).limited,false);
 for(let i=0;i<10;i++)assert.equal((await gateMessage('Hej','192.0.2.44')).filtered,false);assert.equal((await gateMessage('Hej','192.0.2.44')).via,'rate-limit');
});
test('original Excel contains all four languages and no AI_SAVE import',{skip:!process.env.TEST_FAQ_FILE},async()=>{
 const parsed=await parseWorkbook(await fs.readFile(process.env.TEST_FAQ_FILE));for(const l of ['SE','DA','DE','EN'])assert.ok(parsed[l].length>0,l);
 for(const row of parsed.SE)assert.ok(!row.question.startsWith('2025-'));
});
const env={CONTACT_EMAIL:'info@example.com',CONTACT_EMAIL_VERIFIED:'true',LIVE_CHAT_URL:'https://example.com/chat'};

test('structural sizing and support counts require personal contact in all four languages',async()=>{
 const samples={
  SE:['Vilken bärighet har min altan?','Hur många fötter behöver jag till 30 m2?','Vilka dimensioner ska träreglarna ha?','Vilket regelavstånd behöver jag?'],
  DA:['Hvilken bæreevne har min terrasse?','Hvor mange støttefødder skal jeg bruge til 30 m2?','Hvilke dimensioner skal træbjælkerne have?'],
  DE:['Welche Tragfähigkeit hat meine Terrasse?','Wie viele Stelzlager brauche ich für 30 m2?','Welche Abmessungen brauchen die Holzbalken?'],
  EN:['What load-bearing capacity does my terrace have?','How many pedestals do I need for 30 m2?','What size joists do I need?'],
 };
 for(const [lang,questions] of Object.entries(samples)) {
  for(const text of questions) {
   // Even an exact FAQ must not turn a site-specific calculation into advice.
   const r=rig({knowledge:async()=>({status:'ready',data:{[lang]:[{question:text,answer:'Unsafe sizing fixture'}]}})});
   const out=await r.pipeline(req(text,{lang}));
   assert.equal(out.via,'CONTACT',text);assert.equal(r.calls(),0,text);
   assert.notEqual(out.reply,'Unsafe sizing fixture');
  }
 }
});

test('structural follow-ups cannot bypass personal contact; general installation FAQ still works',async()=>{
 const r=rig();
 assert.equal((await r.pipeline(req('Ja gärna',{conversation:[{role:'user',content:'Hur många fötter behöver jag?'},{role:'assistant',content:'Let me calculate that.'}]}))).via,'CONTACT');
 assert.equal(r.calls(),0);
 const question='Hur lägger man klinkerdäck på träreglar?';
 const general=rig({knowledge:async()=>({status:'ready',data:{SE:[{question,answer:'Följ den verifierade monteringsanvisningen.'}]}})});
 assert.equal((await general.pipeline(req(question))).via,'faq');assert.equal(general.calls(),0);
});

test('real gate admits structural questions for contact and still blocks abuse first',async()=>{
 let loads=0,calls=0;
 const chat=createChatPipeline({gate:gateMessage,knowledge:async()=>{loads++;throw Error('must not load');},ai:async()=>{calls++;return 'unsafe';}});
 const examples={SE:'Hur många fötter behöver jag till min altan?',DA:'Hvor mange støttefødder skal jeg bruge?',DE:'Wie viele Stelzlager brauche ich?',EN:'How many pedestals do I need?'};
 let id=210;
 for(const [lang,text] of Object.entries(examples)) {
  assert.equal((await chat({body:{text,lang},headers:{'x-forwarded-for':`192.0.2.${id++}`}})).via,'CONTACT',text);
 }
 assert.equal((await chat({body:{text:'casino hur många fötter?',lang:'SE'},headers:{'x-forwarded-for':'192.0.2.219'}})).via,'FILTER');
 assert.equal(loads,0);assert.equal(calls,0);
});
test('open, closed, unknown and staff presence produce correct links',()=>{
 const place={currentOpeningHours:{openNow:true},internationalPhoneNumber:'+46 40 123456',timeZone:{id:'Europe/Stockholm'}};
 assert.deepEqual(contactState({place,staffAvailable:true,env}).links.map(l=>l.type),['email','phone','chat']);
 assert.equal(contactState({place,staffAvailable:false,env}).links.some(l=>l.type==='chat'),false);
 assert.deepEqual(contactState({place:{...place,currentOpeningHours:{openNow:false}},env}).links.map(l=>l.type),['email']);assert.equal(contactState({env}).openNow,null);
});
test('special current hours override regular hours; Google failure stays unknown',async()=>{
 assert.equal(contactState({place:{regularOpeningHours:{openNow:true},currentOpeningHours:{openNow:false}},env}).openNow,false);
 assert.equal((await getStoreContact({env:{...env,GOOGLE_PLACE_ID:'test',GOOGLE_PLACES_API_KEY:'test'},fetcher:async()=>{throw Error();}})).openNow,null);
});
test('Stockholm daylight saving transitions',()=>{
 assert.match(stockholmTime(new Date('2026-03-29T00:30:00Z')),/01:30/);assert.match(stockholmTime(new Date('2026-03-29T01:30:00Z')),/03:30/);
 assert.match(stockholmTime(new Date('2026-10-25T00:30:00Z')),/02:30/);assert.match(stockholmTime(new Date('2026-10-25T01:30:00Z')),/02:30/);
});
