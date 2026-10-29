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

test('German separable replacement verbs retain warranty context through the full four-turn flow', async () => {
  let externalCalls = 0;
  const blocked = () => { externalCalls++; throw Error('must not use external data or AI'); };
  const chat = createChatPipeline({ gate: async () => ({ filtered: false }),
    knowledge: blocked, website: blocked, ai: blocked, contact: blocked });
  const history = [];
  const questions = ['Welche Garantie gilt für die Außenfliesen?', 'Wie viele Jahre gilt sie?',
    'Und die Arbeitskosten?', 'Tauschen Sie die ganze Terrasse aus?'];
  for (const text of questions) {
    const result = await chat(request(text, 'DE', { conversation: history.slice(-6) }));
    assert.equal(result.via, 'CONTACT', text);
    assert.equal(result.reply, warrantyContact.DE, text);
    assert.equal(result.canRefine, false);
    history.push({ role: 'user', content: text }, { role: 'assistant', content: result.reply });
  }
  for (const text of ['Tauscht ihr die ganze Terrasse aus?', 'Ersetzen Sie die gesamte Terrasse?',
    'Kann ich die ganze Terrasse austauschen?']) {
    const result = await chat(request(text, 'DE', { conversation: history.slice(0, 2), refine: true }));
    assert.equal(result.reply, warrantyContact.DE, text);
    assert.equal(result.canRefine, false);
  }
  assert.equal(externalCalls, 0);
});

test('warranty routing survives a six-message window in eight-turn UI flows in all languages', async () => {
  const flows = {
    SE: ['Hur lång garanti har Testplatta?', 'Hur många år?', 'Och arbetskostnaden?', 'Byter ni hela däcket?'],
    DA: ['Hvor lang garanti er der på Testflise?', 'Hvor mange år?', 'Og arbejdslønnen?', 'Udskifter I hele terrassen?'],
    DE: ['Welche Garantie gilt für Testfliese?', 'Wie viele Jahre?', 'Und die Arbeitskosten?', 'Tauschen Sie die ganze Terrasse aus?'],
    EN: ['How long is the warranty for TestTile?', 'How many years?', 'And labour costs?', 'Replace the entire deck?'],
  };
  for (const [lang, [initial, ...followups]] of Object.entries(flows)) {
    let loads = 0, modelCalls = 0, history = [], routingContext = null;
    const chat = createChatPipeline({ gate: async () => ({ filtered: false }),
      website: async () => { loads++; return { status: 'disabled' }; },
      knowledge: async () => { loads++; return { status: 'ready', data: { [lang]: [syntheticRow({ lang,
        question: followups[0], answer: 'Synthetic unrelated duration: ten years.', evidence })] } }; },
      ai: async () => { modelCalls++; return 'Synthetic unsupported duration'; },
    });
    for (const text of [initial, ...followups, ...followups, followups[0]]) {
      const out = await chat(request(text, lang, { conversation: history, routingContext }));
      assert.equal(out.reply, warrantyContact[lang], `${lang}: ${text}`);
      assert.equal(out.canRefine, false);
      assert.equal(out.routingContext, 'warranty');
      routingContext = out.routingContext;
      // CONTACT responses are not stored as assistant messages by the real UI.
      history = [...history, { role: 'user', content: text }].slice(-6);
    }
    assert.equal(history.some(t => t.content === initial), false);
    assert.equal(loads, 0); assert.equal(modelCalls, 0);
  }
});

test('a warranty hint cannot approve facts or latch onto a new technical or colour topic', async () => {
  const questions = {
    SE: ['Är Testplatta frostbeständig?', 'Vilka färger finns i Testplatta?'],
    DA: ['Er Testflise frostbestandig?', 'Hvilke farver findes i Testflise?'],
    DE: ['Ist Testfliese frostbeständig?', 'Welche Farben gibt es in Testfliese?'],
    EN: ['Is TestTile frost resistant?', 'What colours are available in TestTile?'],
  };
  for (const [lang, items] of Object.entries(questions)) {
    const chat = createChatPipeline({ gate: async () => ({ filtered: false }), website: async () => ({ status: 'disabled' }),
      knowledge: async () => ({ status: 'ready', data: { [lang]: items.map(question => syntheticRow({ lang, question, answer: 'Synthetic approved property.', evidence })) } }) });
    for (const text of items) {
      const out = await chat(request(text, lang, { routingContext: 'warranty' }));
      assert.equal(out.via, 'faq', text);
      assert.equal(out.routingContext, undefined);
    }
    const conjunction = { SE: 'Och ', DA: 'Og ', DE: 'Und ', EN: 'And ' }[lang];
    for (const text of items) {
      const out = await chat(request(conjunction + text, lang, { routingContext: 'warranty' }));
      assert.notEqual(out.routingContext, 'warranty', text);
      assert.notEqual(out.reply, warrantyContact[lang], text);
    }
    const coverage = { SE: 'Gäller det frost?', DA: 'Gælder det frost?', DE: 'Gilt das bei Frost?', EN: 'Does it apply to frost?' }[lang];
    assert.equal((await chat(request(coverage, lang, { routingContext: 'warranty' }))).reply, warrantyContact[lang]);
    for (const forged of ['approved', 'faq', { approvalStatus: 'approved' }]) {
      const out = await chat(request('Synthetic unsupported specification?', lang, { routingContext: forged }));
      assert.equal(out.via, 'CONTACT');
      assert.equal(out.factStatus, undefined);
    }
  }
});

test('warranty routing hint does not bypass abuse controls or create contact side effects', async () => {
  let externalCalls = 0;
  const blocked = () => { externalCalls++; throw Error('must not call'); };
  const chat = createChatPipeline({ gate: async () => ({ filtered: true }), knowledge: blocked, website: blocked, contact: blocked, ai: blocked });
  const out = await chat(request('And labour costs? casino', 'EN', { routingContext: 'warranty' }));
  assert.equal(out.via, 'FILTER');
  assert.equal(externalCalls, 0);
});
