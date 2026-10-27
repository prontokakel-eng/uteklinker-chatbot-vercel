import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatPipeline } from '../lib/chatPipeline.js';
import { answerDialogue } from '../lib/dialogue-ai.js';
import { createChatHandler } from '../api/chat.js';
import { createReviewStore, REVIEW_HEADERS } from '../lib/ai-review-store.js';
import { syntheticRow, syntheticEvidence } from './fixtures/approved-synthetic.mjs';
import { createWebsiteLookup } from '../lib/website-knowledge.js';

// Swedish baseline runs through the real Preview controller and HTTP handler.
// Only external services are faked: no model costs or live Sheet mutations.
const env={VERCEL_ENV:'preview',AI_DIALOGUE_ENABLED:'true',OPENAI_MODEL:'gpt-6.1-sol',SHEET_ID:'synthetic-review'};
const treatment=syntheticRow({question:'Behöver testplattorna behandlas med impregnering?',answer:'Testplattorna behöver inte impregneras.',evidence:syntheticEvidence});
const drainage=syntheticRow({question:'Hur lägger man klinkerdäck på träreglar?',answer:'Normalt rekommenderas cirka 1 % fall från huset.',evidence:{...syntheticEvidence,sourceId:'synthetic:drainage'}});
let nextIp=10;
function rig({rows=[treatment,drainage],outputs=[],reviews=[],storageFails=false,website=async()=>({status:'unavailable'})}={}) {
  const calls=[],reviewCalls=[],appends=[];
  const client={responses:{create:async params=>{
    if(params.tools?.[0]?.name==='review_answer'){
      reviewCalls.push(params);
      return {status:'completed',usage:{output_tokens:100},output:[{type:'function_call',name:'review_answer',arguments:JSON.stringify(reviews.shift() || {decision:'allow',reason:'none',needsEvidence:false,evidence:[]})}]};
    }
    calls.push(params);assert.ok(outputs.length,'Unexpected model call');
    const {reply,kind='general',sourceIds=[]}=outputs.shift();
    return {id:'synthetic-response',model:'gpt-6.1-sol',status:'completed',usage:{input_tokens:100,output_tokens:100},
      output:[{type:'function_call',call_id:'synthetic-call',name:'respond',arguments:JSON.stringify({reply,kind,sourceIds})}]};
  }}};
  const knowledge=async()=>({status:'ready',data:{SE:rows}});
  const chat=createChatPipeline({env,knowledge,dialogue:args=>answerDialogue({...args,client}),
    website,catalog:async()=>({status:'unavailable'})});
  const sheets={spreadsheets:{values:{get:async()=>({data:{values:[REVIEW_HEADERS]}}),append:async args=>{
    if(storageFails)throw Error('Synthetic storage outage');
    appends.push(args);return {data:{updates:{updatedRange:'AI_REVIEW!A2:O2'}}};
  }}}};
  const handler=createChatHandler({chat,saveReview:createReviewStore({env,sheets})});
  const ip=`198.51.100.${nextIp++}`;
  return {calls,reviewCalls,appends,ask:async(text,extra={})=>{
    let body,status;
    const res={setHeader(){},status(value){status=value;return this;},json(value){body=value;}};
    await handler({method:'POST',body:{text,lang:'SE',...extra},headers:{'x-forwarded-for':ip}},res);
    assert.equal(status,200);assert.ok(body.reply);return body;
  }};
}

test('Preview Swedish: exact, misspelled and reordered FAQ return the approved answer with no AI/save',async()=>{
  const r=rig();
  for(const text of [treatment.question,'Behöver testplattorna behandlas med impregnerng?','Med impregnering behöver testplattorna behandlas?']) {
    const result=await r.ask(text);assert.equal(result.source,'FAQ',text);assert.equal(result.reply,treatment.answer);
    assert.deepEqual(result.modelDiagnostics,[]);assert.equal(result.evidence,undefined);
  }
  assert.equal(r.calls.length,0);assert.equal(r.appends.length,0);
});

test('Preview Swedish: a misleading numerical almost-match cannot become direct FAQ',async()=>{
  const row=syntheticRow({question:'Kan testplattan användas i format 60x60?',answer:'Syntetiskt svar endast för 60x60.',evidence:syntheticEvidence});
  const r=rig({rows:[row],outputs:[{reply:'Det här kan jag inte verifiera.',kind:'contact'}]});
  assert.equal((await r.ask('Kan testplattan användas i format 90x90?')).source,'CONTACT');
  assert.equal(r.appends.length,0);
});

const rejectFact={decision:'handoff',reason:'unsupported_fact',needsEvidence:false,evidence:[]};
for(const kind of ['general','clarify','sourced']) test(`Preview Swedish: semantic review rejects reversed drainage even when labelled ${kind}`,async()=>{
  const r=rig({reviews:[{...rejectFact,reason:'unsafe_advice'}],outputs:[{reply:'Lägg cirka 1 % fall mot huset.',kind,sourceIds:kind==='sourced'?[drainage.evidence.sourceId]:[]}]});
  const result=await r.ask(drainage.question,{refine:true});
  assert.equal(result.source,'CONTACT');assert.doesNotMatch(result.reply,/fall mot huset/);
  assert.ok(result.modelDiagnostics.some(t=>t.review==='handoff' && t.reason==='unsafe_advice'));
  assert.equal(r.calls.length,1);assert.equal(r.appends.length,0);
});

test('Preview Swedish: supported drainage explanation is allowed and saved as unreviewed',async()=>{
  const reply='Fallet från huset hjälper vattnet att rinna bort från fasaden.';
  const r=rig({outputs:[{reply,kind:'sourced',sourceIds:[drainage.evidence.sourceId]}]});
  assert.equal((await r.ask(drainage.question,{refine:true})).reply,reply);
  assert.equal(r.appends.length,1);assert.equal(r.appends[0].requestBody.values[0][4],'Ej granskat');
});

for(const kind of ['general','clarify']) test(`Preview Swedish: unsourced nonnumeric product claim is blocked despite ${kind}`,async()=>{
  const r=rig({reviews:[rejectFact],outputs:[{reply:'Auditplatta QZX är frostbeständig.',kind}]});
  const result=await r.ask('Är Auditplatta QZX frostbeständig?');
  assert.equal(result.source,'CONTACT');assert.ok(result.modelDiagnostics.some(t=>t.review==='handoff' && t.reason==='unsupported_fact'));
  assert.equal(r.appends.length,0);
});

test('Preview Swedish: prior assistant claims and an unrelated valid source cannot verify an unknown product',async()=>{
  for(const sourceIds of [[],[treatment.evidence.sourceId]]) {
    const r=rig({reviews:[rejectFact],outputs:[{reply:'Auditplatta QZX är frostbeständig.',kind:'general',sourceIds}]});
    // Make the unrelated source available without turning the request into a direct FAQ.
    const result=await r.ask(treatment.question,{refine:true,conversation:[{role:'assistant',content:'Auditplatta QZX är frostbeständig.'}]});
    assert.equal(result.source,'CONTACT');assert.equal(r.appends.length,0);
  }
});

test('Preview Swedish: valid sourced nonnumeric product fact remains available',async()=>{
  const row=syntheticRow({question:'Är Auditplatta QZX frostbeständig?',answer:'Auditplatta QZX är frostbeständig.',evidence:syntheticEvidence});
  const r=rig({rows:[row],outputs:[{reply:row.answer,kind:'sourced',sourceIds:[row.evidence.sourceId]}]});
  assert.equal((await r.ask(row.question,{refine:true})).source,'AI');assert.equal(r.appends.length,1);
});

test('Preview Swedish: a colour source does not authorize frost claims about the same product',async()=>{
  const row=syntheticRow({question:'Vilken färg har Auditplatta QZX?',answer:'Auditplatta QZX har en ljusgrå färg.',evidence:syntheticEvidence});
  const r=rig({rows:[row],reviews:[rejectFact],outputs:[{reply:'Auditplatta QZX är frostbeständig.',kind:'sourced',sourceIds:[row.evidence.sourceId]}]});
  const result=await r.ask(row.question,{refine:true});
  assert.equal(result.source,'CONTACT');assert.equal(r.appends.length,0);
});

test('Preview Swedish: short and nominal product assertions also require evidence',async()=>{
  for(const reply of ['Ja, den tål det.','Auditplatta QZX: frostbeständig.','auditplatta qzx är frostbeständig.']) {
    const r=rig({reviews:[rejectFact],outputs:[{reply,kind:'clarify'}]});
    assert.equal((await r.ask('Är Auditplatta QZX frostbeständig?')).source,'CONTACT',reply);
    assert.equal(r.appends.length,0);
  }
});

test('Preview Swedish: missing product evidence still permits an honest preference clarification',async()=>{
  const r=rig({outputs:[{reply:'Vilket format vill du ha?',kind:'clarify'}]});
  assert.equal((await r.ask('Jag söker frostbeständiga plattor.')).source,'AI');
});

test('Preview Swedish: general definitions and customer measurements still work and save only pending drafts',async()=>{
  const r=rig({outputs:[{reply:'Granitkeramik är ett tätt keramiskt material.'},
    {reply:'Då utgår vi från 30 m². Finns det redan ett underlag?',kind:'clarify'}]});
  assert.equal((await r.ask('Vad är granitkeramik?')).source,'AI');
  const conversation=[{role:'user',content:'Jag planerar en uteplats.'},{role:'assistant',content:'Hur stor ska den vara?'}];
  assert.equal((await r.ask('30 m²',{conversation})).source,'AI');
  assert.ok(JSON.stringify(r.calls[1].input).includes('Hur stor ska den vara?'));
  assert.equal(r.appends.length,2);
  for(const append of r.appends) {
    assert.equal(append.range,"'AI_REVIEW'!A:O");assert.equal(append.valueInputOption,'RAW');
    const row=append.requestBody.values[0];assert.equal(row[4],'Ej granskat');assert.equal(row[8],'ai');
    assert.deepEqual(row.slice(9,13),['','','','']);
  }
});

test('Preview Swedish: whitelist format reaches dialogue while blacklist and gibberish still stop first',async()=>{
  const r=rig({outputs:[{reply:'Vilket utseende vill du ha?',kind:'clarify'}]});
  assert.equal((await r.ask('60x60cm')).source,'AI');
  assert.equal((await r.ask('Hej casino 60x60cm')).source,'FILTER');
  assert.equal((await r.ask('asdfghjkl')).source,'FILTER');
  assert.equal(r.calls.length,1);assert.equal(r.appends.length,1);
});

test('Preview Swedish: warranty, prices, stock and support counts remain outside Sol and review storage',async()=>{
  const r=rig();
  for(const text of ['Vilken garanti har plattorna?','Vad kostar Meteor Salt?','Finns Meteor Salt i lager?','Hur många fötter behöver jag?']) {
    assert.equal((await r.ask(text)).source,'CONTACT',text);
  }
  assert.equal(r.calls.length,0);assert.equal(r.appends.length,0);
});

test('Preview Swedish: a review storage failure preserves the safe customer answer',async()=>{
  const reply='Vilket utseende vill du ha?';
  const r=rig({storageFails:true,outputs:[{reply,kind:'clarify'}]});
  assert.equal((await r.ask('Jag planerar en uteplats.')).reply,reply);
  assert.equal(r.appends.length,0);
});

test('Preview Swedish: general material, slip and child-safety explanations do not certify a product',async()=>{
  for(const [question,reply] of [
    ['Det är en träaltan. Förklara skillnaden mellan granitkeramik och natursten.','Granitkeramik tillverkas av keramiska råvaror. Natursten bryts ur berg och kan ha varierande porositet och färg.'],
    ['Kan du förklara skillnaden mellan halkklassning och att en yta aldrig kan bli hal?','En halkklassning beskriver hur ytan har testats. Vatten, smuts och is kan fortfarande göra ytan hal.'],
    ['Vad bör jag generellt tänka på när barn springer barfota?','Håll gångytorna rena och undvik stående vatten. En klassning betyder inte att olyckor aldrig kan inträffa.'],
  ]) {
    const r=rig({outputs:[{reply}]});
    const result=await r.ask(question,{conversation:[{role:'user',content:'Jag tittar på Auditplatta QZX.'}]});
    assert.equal(result.source,'AI',question);assert.equal(result.reply,reply);assert.equal(r.appends.length,1);
  }
});

test('Preview Swedish: a clarification keeps an unclear product request moving without inventing a property',async()=>{
  const reply='Menar du plattans egenskaper eller hur altanen behöver byggas?';
  const r=rig({outputs:[{reply,kind:'clarify'}]});
  assert.equal((await r.ask('Jag är osäker på vad som passar mitt projekt.')).reply,reply);
});

test('Preview Swedish: ordinary concept nouns and viktigt do not become product names or weight claims',async()=>{
  for(const reply of ['Dränering är viktig eftersom vatten behöver kunna rinna undan.',
    'Porositeten har betydelse för hur material tar upp vatten. Dränering kan påverka hur mycket vatten som blir stående.',
    'Ett bra underlag är viktigt. Vatten som fryser kan få underlaget att röra sig.']) {
    const r=rig({outputs:[{reply}]});
    assert.equal((await r.ask('Varför är det viktigt att underlaget släpper igenom vatten? Förklara enkelt.')).source,'AI',reply);
  }
});

test('Preview Swedish: summarizing corrected customer measurements is not a product specification',async()=>{
  const reply='Du planerar en uteplats på 25 m² på betong. Du har inte valt färg eller format ännu.';
  const r=rig({outputs:[{reply,kind:'clarify'}]});
  const result=await r.ask('Kan du sammanfatta vad du vet om mitt nya projekt, utan att anta färg eller format?',{
    conversation:[{role:'user',content:'Jag planerar 35 m² uteplats.'},{role:'assistant',content:'Vilket underlag?'},
      {role:'user',content:'Nej, jag räknade fel. Det är 25 m², på betong.'}],
  });
  assert.equal(result.source,'AI');assert.equal(result.reply,reply);
});

test('Preview Swedish: an explanation request cannot disguise an unsupported named-product assertion',async()=>{
  for(const question of ['Förklara om Auditplatta QZX är frostbeständig.','Vad är det för egenskaper hos Auditplatta QZX?']) {
    const r=rig({reviews:[rejectFact],outputs:[{reply:'Den är frostbeständig.',kind:'general'}]});
    assert.equal((await r.ask(question)).source,'CONTACT',question);assert.equal(r.appends.length,0);
  }
});

test('Preview Swedish: conversational rating questions use exact website evidence without a model call',async()=>{
  const url='https://klinkerdack.se/uteklinker-teststone-shade';
  const website=createWebsiteLookup({fetcher:async u=>{
    if(u.endsWith('/robots.txt'))return new Response('User-agent: *\nSitemap: https://klinkerdack.se/sitemap.xml',{headers:{'content-type':'text/plain'}});
    if(u.endsWith('/sitemap.xml'))return new Response(`<urlset><url><loc>${url}</loc></url></urlset>`,{headers:{'content-type':'application/xml'}});
    assert.equal(u,url);
    return new Response('<h1>Uteklinker Teststone Shade</h1><div class="specifikation-hela-rutan"><div class="product-specs-table"><div class="ml-variant-vtext-row"><span class="ml-variant-vtext-title">Yta:</span> R10/Antislip</div></div></div>',{headers:{'content-type':'text/html'}});
  }});
  for(const text of ['Jag tittar på Teststone Shade. Vilken R-klassning har den enligt er hemsida?',
    'Jag gillar nyansen. Vilken R-klassning har Teststone Shade enligt produktsidan?',
    'Jag funderar på Teststone Shade runt poolen. Vilken R-klassning anges på er hemsida?']) {
    const r=rig({website:args=>website({...args,env:{...env,WEBSITE_KNOWLEDGE_ENABLED:'true'}})});
    const result=await r.ask(text);
    assert.equal(result.source,'WEBSITE',text);assert.match(result.reply,/R10/);
    assert.equal(result.citations[0].url,url);assert.equal(result.factStatus,'website-observed');
    assert.equal(r.calls.length,0);assert.equal(r.appends.length,0);
  }
});

test('Preview Swedish: complex construction receives an explicit project-specific support handoff',async()=>{
  const r=rig();const result=await r.ask('Vilket regelavstånd behövs när altanen ska bära ett tungt spabad?');
  assert.equal(result.source,'CONTACT');assert.match(result.reply,/projekts komplexitet/);
  assert.match(result.reply,/kontaktar supporten/);assert.match(result.reply,/på plats/);
  assert.equal(r.calls.length,0);assert.equal(r.appends.length,0);
});
