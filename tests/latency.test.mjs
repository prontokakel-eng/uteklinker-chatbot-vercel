import test from 'node:test';
import assert from 'node:assert/strict';
import {withLatency,timeStage,latencyMeta,serverTiming} from '../lib/latency.js';
import {createChatHandler} from '../api/chat.js';
test('timing isolates concurrent requests and records failed stages without customer text',async()=>{
 let now=0;
 await withLatency(async trace=>{
  latencyMeta({knowledgeCache:'memory',question:'secret customer question'});
  await timeStage('faq_lookup',async()=>{now+=13;});
  await assert.rejects(timeStage('model_generate',async()=>{now+=7;throw Error('private provider error');}));
  const result=trace.snapshot();assert.equal(result.totalMs,20);assert.equal(result.knowledgeCache,'memory');
  assert.equal(result.events[0].durationMs,13);assert.equal(result.events[1].ok,false);
  assert.doesNotMatch(JSON.stringify(result),/secret|private/);assert.match(serverTiming(result),/faq_lookup;dur=13/);
 },{clock:()=>now});
});
test('Preview HTTP timings include review storage, production never publishes timing metadata',async()=>{
 for(const environment of ['preview','production']){
  let body;const headers={};
  const handler=createChatHandler({env:{VERCEL_ENV:environment},chat:async()=>({via:'AI',reply:'A synthetic answer.'}),saveReview:async()=>{}});
  await handler({method:'POST',body:{text:'Synthetic'},headers:{}},{setHeader:(k,v)=>headers[k]=v,status(){return this;},json:value=>body=value});
  assert.equal(!!body.performance,environment==='preview');assert.equal(!!headers['Server-Timing'],environment==='preview');
  if(body.performance)assert.ok(body.performance.events.some(e=>e.stage==='review_storage'));
 }
});
