import test from 'node:test';
import assert from 'node:assert/strict';
import { createChatPipeline } from '../lib/chatPipeline.js';
import { gateMessage } from '../lib/gate.js';
let id=100;
function rig() {
 const calls={google:0,ai:0};
 const pipeline=createChatPipeline({gate:gateMessage,knowledge:async()=>{calls.google++;return {status:'ready',data:{SE:[{question:'Vilka färger finns i Lava?',answer:'Etna'}]}};},ai:async()=>{calls.ai++;return 'AI';}});
 const ip=`198.51.100.${id++}`;
 return {calls,query:text=>pipeline({body:{text,lang:'SE'},headers:{'x-forwarded-for':ip}})};
}
test('empty, oversized, gibberish, repetitive and blacklist input stop before external calls',async()=>{
 for(const text of ['', 'a'.repeat(2001), 'asdfghjkl', 'sanity-test '.repeat(4), 'casino 60x60', 'Hej casino 60x60']) {
  const r=rig();assert.equal((await r.query(text)).via,'FILTER',text.slice(0,50));assert.deepEqual(r.calls,{google:0,ai:0});
 }
});
test('greetings and shortwords use local replies without Google or OpenAI',async()=>{
 for(const text of ['Hej','Hi','Ok','Hello','Hej, how are you?']) {
  const r=rig();assert.equal((await r.query(text)).via,'GREETING',text);assert.deepEqual(r.calls,{google:0,ai:0});
 }
});
test('eleventh greeting is throttled before external calls',async()=>{
 const r=rig();for(let i=0;i<10;i++)assert.equal((await r.query('Hej')).via,'GREETING');
 const out=await r.query('Hej');assert.equal(out.via,'rate-limit');assert.ok(out.retryAfter>0);assert.deepEqual(r.calls,{google:0,ai:0});
});
test('legitimate FAQ and dimensions are still accepted',async()=>{
 const r=rig();assert.equal((await r.query('Vilka färger finns i Lava?')).via,'faq');assert.deepEqual(r.calls,{google:1,ai:0});
 for(const q of ['Hur lägger man plattor 60x60 cm på träreglar?','Vilket stöd behövs för 45x145 mm reglar?'])assert.equal((await gateMessage(q,`198.51.100.${id++}`)).filtered,false,q);
});

test('100 concurrent FAQ requests from one IP admit ten and throttle ninety before data or AI',async()=>{
 const r=rig();
 const results=await Promise.all(Array.from({length:100},()=>r.query('Vilka färger finns i Lava?')));
 assert.equal(results.filter(x=>x.via==='faq').length,10);
 const blocked=results.filter(x=>x.via==='rate-limit');
 assert.equal(blocked.length,90);assert.ok(blocked.every(x=>x.retryAfter>0));
 assert.deepEqual(r.calls,{google:10,ai:0});
 // A second customer remains independent of the first customer's burst.
 const other=rig();assert.equal((await other.query('Vilka färger finns i Lava?')).via,'faq');
});

test('100 concurrent greetings make zero external calls and still enforce the limit',async()=>{
 const r=rig();const results=await Promise.all(Array.from({length:100},()=>r.query('Hej')));
 assert.equal(results.filter(x=>x.via==='GREETING').length,10);
 assert.equal(results.filter(x=>x.via==='rate-limit').length,90);
 assert.deepEqual(r.calls,{google:0,ai:0});
});
