import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createChatPipeline } from '../lib/chatPipeline.js';
import { findKnowledge } from '../lib/drive-knowledge.js';

test('natural load/weight questions in all four languages stop before FAQ and AI', async () => {
 const samples={SE:'Hur mycket vikt klarar ett klinkerdäck på träreglar?',DA:'Hvor stor vægt kan udendørsfliser på træbjælker bære?',DE:'Wie viel Gewicht kann ein Fliesenbelag auf Holzbalken tragen?',EN:'How much weight can outdoor tiles on wooden joists support?'};
 for(const [lang,text] of Object.entries(samples)) {
  const chat=createChatPipeline({gate:async()=>({filtered:false}),knowledge:async()=>{throw Error('must not load');},ai:async()=>{throw Error('must not call AI');}});
  const request=(text,extra={})=>({body:{text,lang,...extra},headers:{}});
  assert.equal((await chat(request(text))).via,'CONTACT',text);
  assert.equal((await chat(request(lang==='EN'?'Yes please':lang==='DE'?'Ja bitte':lang==='DA'?'Ja tak':'Ja gärna',{conversation:[{role:'user',content:text}]}))).via,'CONTACT',lang);
 }
});
test('English colour lists keep series identity instead of fuzzy borrowing', () => {
 const row={question:'What colors are available in the Lava series?',answer:'Verified fixture',lang:'EN'};
 const data={EN:[row,{question:'What colors are available in the Albero series?',answer:'Other fixture',lang:'EN'}]};
 for(const q of ['What colours are available in Lava?','What colors does Lava have?','Lava colours?']) {
  assert.equal(findKnowledge(data,'EN',q)[0]?.answer,row.answer,q);
 }
 for(const entity of ['Lavo','Lava Pro','Lava and Albero','Lava 60x60'])assert.deepEqual(findKnowledge(data,'EN',`What colors are available in ${entity}?`),[],entity);
 assert.equal(findKnowledge(data,'EN',row.question)[0].score,0);
 const conflict={EN:[row,{question:'Lava colors?',answer:'Conflicting fixture'}]};
 assert.deepEqual(findKnowledge(conflict,'EN','What colors does Lava have?'),[]);
});
test('production logging excludes customer text, IP addresses and credential fragments', () => {
 const child=spawnSync(process.execPath,['--input-type=module','-e',`import {logMessage} from './lib/logger.js';logMessage('gate.log','customer@example.com 198.51.100.7 sk-fake-private order 123');`],{cwd:new URL('..',import.meta.url),env:{...process.env,VERCEL:'1'},encoding:'utf8'});
 assert.equal(child.status,0,child.stderr);
 assert.match(child.stdout,/gate\.log.*event/);
 for(const secret of ['customer@example.com','198.51.100.7','sk-fake-private','order 123'])assert.ok(!child.stdout.includes(secret),secret);
});
