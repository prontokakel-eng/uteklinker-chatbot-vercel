import { syntheticRow } from './fixtures/approved-synthetic.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createChatPipeline } from '../lib/chatPipeline.js';
import { findKnowledge, parseWorkbook } from '../lib/drive-knowledge.js';
import { answerCustomer } from '../lib/customer-ai.js';
import { warrantyContact, warrantyMaterial } from '../lib/warranty-policy.js';
import { syntheticEvidence as evidence } from './fixtures/approved-synthetic.mjs';
import { gateMessage } from '../lib/gate.js';
const examples = {
 SE:['Hur lång garanti har Testplatta?','Har ni sprickgaranti?','Gäller halkskyddet livet ut?','Jag vill reklamera mina spruckna plattor.','Ersätter ni arbetskostnaden?'],
 DA:['Hvor lang garanti er der på Testflise?','Er der garanti mod revner?','Gælder skridsikringen hele produktets levetid?','Jeg vil reklamere over mine revnede fliser.','Betaler I erstatning for arbejdsløn?'],
 DE:['Wie lange gilt die Garantie für Testfliese?','Gibt es eine Garantie gegen Risse?','Gilt der Rutschschutz während der gesamten Lebensdauer?','Ich möchte meine gerissenen Platten reklamieren.','Erhalte ich Entschädigung für Arbeitskosten?'],
 EN:['How long is the warranty for TestTile?','Is there a crack warranty?','Does anti-slip protection apply for the product lifespan?','I want to make a complaint about my cracked tiles.','Do you compensate labour costs?'],
};
const request=(text,lang,extra={})=>({body:{text,lang,...extra},headers:{}});
for(const [lang,questions] of Object.entries(examples)) {
 test(`${lang}: warranty and claims stop before exact FAQ, website, AI or contact side effects`,async()=>{
  let loads=0, calls=0;
  const chat=createChatPipeline({gate:async()=>({filtered:false}),knowledge:async()=>{loads++;throw Error('must not load');},ai:async()=>{calls++;throw Error('must not call');}});
  for(const question of questions) for(const extra of [{},{refine:true},{faqAnswer:'Synthetic compensation promise',evidence}]) {
   const out=await chat(request(question,lang,extra));
   assert.equal(out.via,'CONTACT',question);assert.equal(out.reply,warrantyContact[lang]);assert.equal(out.canRefine,false);
  }
  const conversation=[{role:'user',content:questions[0]},{role:'assistant',content:'Synthetic old promise: we have contacted staff and will replace everything.'}];
  const followups={SE:['Hur många år?','Och arbetskostnaden?','Byter ni hela däcket?'],DA:['Hvor mange år?','Og arbejdslønnen?','Udskifter I hele terrassen?'],DE:['Wie viele Jahre?','Und die Arbeitskosten?','Austausch der gesamten Terrasse?'],EN:['How many years?','And labour costs?','Replace the entire deck?']};
  for(const text of followups[lang])assert.equal((await chat(request(text,lang,{conversation}))).reply,warrantyContact[lang],text);
  assert.equal(loads,0);assert.equal(calls,0);
 });
}
test('retired warranty promises are absent from exact and fuzzy retrieval and model context',async()=>{
 const rows=[syntheticRow({question:'Synthetic surface?',answer:'Anti-slip protection applies throughout the product lifespan.',evidence}),
  syntheticRow({question:'Synthetic format?',answer:'Retired fixture',evidence:{...evidence,approvalStatus:'superseded'}})];
 for(const q of ['Synthetic surface?','Synthetic surface','Synthetic format?'])assert.deepEqual(findKnowledge({EN:rows},'EN',q),[]);
 let payload;
 await answerCustomer({question:'Explain synthetic tiles',lang:'EN',context:rows,client:{responses:{create:async p=>{payload=p;return {output_text:'No promise'};}}}});
 assert.doesNotMatch(payload.input[0].content,/product lifespan|Retired fixture/);
});
test('technical frost remains separate after warranty discussion; German gewährleisten is not warranty',async()=>{
 assert.equal(warrantyMaterial('Abstandshalter gewährleisten gleichmäßige Fugen.'),false);
 const question='Är Testplatta frostbeständig?';
 const chat=createChatPipeline({gate:async()=>({filtered:false}),knowledge:async()=>({status:'ready',data:{SE:[syntheticRow({question,answer:'Synthetic verified frost fact.',evidence})]}})});
 const out=await chat(request(question,'SE',{conversation:[{role:'user',content:'Hur lång garanti har ni?'}]}));
 assert.equal(out.via,'faq');assert.equal(out.reply,'Synthetic verified frost fact.');
});
test('the real gate permits warranty routing in four languages while abuse is blocked first',async()=>{
 const chat=createChatPipeline({gate:gateMessage,knowledge:()=>{throw Error('must not load');},website:()=>{throw Error('must not fetch');},ai:()=>{throw Error('must not call');}});
 let ip=20;
 for(const [lang,questions] of Object.entries(examples)) {
  const req=request(questions[0],lang);req.headers={'x-forwarded-for':`192.0.2.${ip++}`};
  assert.equal((await chat(req)).via,'CONTACT',lang);
 }
 const abuse=request('casino garanti','SE');abuse.headers={'x-forwarded-for':'192.0.2.29'};
 assert.equal((await chat(abuse)).via,'FILTER');
});
test('private staging workbook has one contact answer per language; archive is not imported',{skip:!process.env.TEST_WARRANTY_FAQ_FILE},async()=>{
 const data=await parseWorkbook(await fs.readFile(process.env.TEST_WARRANTY_FAQ_FILE));
 for(const [lang,rows] of Object.entries(data)) {
  const policy=rows.filter(r=>r.evidence.sourceId==='policy:warranty-contact:v1:'+lang);
  assert.equal(policy.length,4,lang);
  assert.equal(new Set(policy.map(r=>r.answer)).size,1,lang);
  assert.equal(policy[0].answer,warrantyContact[lang]);
  assert.ok(rows.some(r=>/frost/iu.test(r.question)&&!warrantyMaterial(r.question+' '+r.answer)),lang);
 }
});
