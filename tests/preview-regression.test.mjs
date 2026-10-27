import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatPipeline } from '../lib/chatPipeline.js';
import { answerDialogue } from '../lib/dialogue-ai.js';
import { createChatHandler } from '../api/chat.js';
import { createReviewStore, REVIEW_HEADERS } from '../lib/ai-review-store.js';
import { syntheticRow, syntheticEvidence } from './fixtures/approved-synthetic.mjs';

// Swedish baseline runs through the real Preview controller and HTTP handler.
// Only external services are faked: no model costs or live Sheet mutations.
const env={VERCEL_ENV:'preview',AI_DIALOGUE_ENABLED:'true',OPENAI_MODEL:'gpt-6.1-sol',SHEET_ID:'synthetic-review'};
const treatment=syntheticRow({question:'Behöver testplattorna behandlas med impregnering?',answer:'Testplattorna behöver inte impregneras.',evidence:syntheticEvidence});
const drainage=syntheticRow({question:'Hur lägger man klinkerdäck på träreglar?',answer:'Normalt rekommenderas cirka 1 % fall från huset.',evidence:{...syntheticEvidence,sourceId:'synthetic:drainage'}});
let nextIp=10;
function rig({rows=[treatment,drainage],outputs=[],storageFails=false}={}) {
  const calls=[],appends=[];
  const client={responses:{create:async params=>{
    calls.push(params);assert.ok(outputs.length,'Unexpected model call');
    const {reply,kind='general',sourceIds=[]}=outputs.shift();
    return {id:'synthetic-response',model:'gpt-6.1-sol',status:'completed',usage:{input_tokens:100,output_tokens:100},
      output:[{type:'function_call',call_id:'synthetic-call',name:'respond',arguments:JSON.stringify({reply,kind,sourceIds})}]};
  }}};
  const knowledge=async()=>({status:'ready',data:{SE:rows}});
  const chat=createChatPipeline({env,knowledge,dialogue:args=>answerDialogue({...args,client}),
    website:async()=>({status:'unavailable'}),catalog:async()=>({status:'unavailable'})});
  const sheets={spreadsheets:{values:{get:async()=>({data:{values:[REVIEW_HEADERS]}}),append:async args=>{
    if(storageFails)throw Error('Synthetic storage outage');
    appends.push(args);return {data:{updates:{updatedRange:'AI_REVIEW!A2:O2'}}};
  }}}};
  const handler=createChatHandler({chat,saveReview:createReviewStore({env,sheets})});
  const ip=`198.51.100.${nextIp++}`;
  return {calls,appends,ask:async(text,extra={})=>{
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

for(const kind of ['general','clarify','sourced']) test(`Preview Swedish: reversed drainage is blocked even when labelled ${kind}`,async()=>{
  const r=rig({outputs:[{reply:'Lägg cirka 1 % fall mot huset.',kind,sourceIds:kind==='sourced'?[drainage.evidence.sourceId]:[]}]});
  const result=await r.ask(drainage.question,{refine:true});
  assert.equal(result.source,'CONTACT');assert.doesNotMatch(result.reply,/fall mot huset/);
  assert.ok(result.modelDiagnostics.some(t=>t.rejected==='reversed_drainage'));
  assert.equal(r.calls.length,1);assert.equal(r.appends.length,0);
});

test('Preview Swedish: supported drainage explanation is allowed and saved as unreviewed',async()=>{
  const reply='Fallet från huset hjälper vattnet att rinna bort från fasaden.';
  const r=rig({outputs:[{reply,kind:'sourced',sourceIds:[drainage.evidence.sourceId]}]});
  assert.equal((await r.ask(drainage.question,{refine:true})).reply,reply);
  assert.equal(r.appends.length,1);assert.equal(r.appends[0].requestBody.values[0][4],'Ej granskat');
});

for(const kind of ['general','clarify']) test(`Preview Swedish: unsourced nonnumeric product claim is blocked despite ${kind}`,async()=>{
  const r=rig({outputs:[{reply:'Auditplatta QZX är frostbeständig.',kind}]});
  const result=await r.ask('Är Auditplatta QZX frostbeständig?');
  assert.equal(result.source,'CONTACT');assert.ok(result.modelDiagnostics.some(t=>t.rejected==='unsupported_product_claim'));
  assert.equal(r.appends.length,0);
});

test('Preview Swedish: prior assistant claims and an unrelated valid source cannot verify an unknown product',async()=>{
  for(const sourceIds of [[],[treatment.evidence.sourceId]]) {
    const r=rig({outputs:[{reply:'Auditplatta QZX är frostbeständig.',kind:'general',sourceIds}]});
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
  const r=rig({rows:[row],outputs:[{reply:'Auditplatta QZX är frostbeständig.',kind:'sourced',sourceIds:[row.evidence.sourceId]}]});
  const result=await r.ask(row.question,{refine:true});
  assert.equal(result.source,'CONTACT');assert.equal(r.appends.length,0);
});

test('Preview Swedish: short and nominal product assertions also require evidence',async()=>{
  for(const reply of ['Ja, den tål det.','Auditplatta QZX: frostbeständig.','auditplatta qzx är frostbeständig.']) {
    const r=rig({outputs:[{reply,kind:'clarify'}]});
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
