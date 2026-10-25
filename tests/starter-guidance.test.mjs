import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { createChatPipeline } from '../lib/chatPipeline.js';

// Exercise the exact prompts shipped by the UI through the real safety gate and
// pipeline, not just a button click or a second copy of the prompt strings.
const source=await fs.readFile(new URL('../public/chat-brand.js',import.meta.url),'utf8');
const literal=source.slice(source.indexOf('const copy =')+'const copy ='.length,source.indexOf('  const select =')).trim().replace(/;$/,'');
const copy=vm.runInNewContext('('+literal+')');
test('all twelve shipped shortcuts produce useful clarification even without approved FAQ matches',async()=>{
 let i=0;
 const chat=createChatPipeline({knowledge:async()=>{throw Error('a discovery question must not need product evidence');},website:async()=>{throw Error('no product requested');},ai:async()=>{throw Error('no generated facts');}});
 for(const [lang,words] of Object.entries(copy))for(const prompt of Object.values(words.prompts)){
  const result=await chat({body:{text:prompt,lang},headers:{'x-forwarded-for':`198.51.100.${++i}`}});
  assert.equal(result.via,'GUIDANCE',lang+': '+prompt);assert.equal(result.factStatus,'clarification');
  assert.ok(result.reply.includes('?'));assert.equal(result.canRefine,false);assert.equal(result.evidence,undefined);
  assert.doesNotMatch(result.reply,/\b(?:R1[0-3]|\d+\s*(?:kr|years|år|Jahre)|guarantee|garanti)\b/i);
 }
});
test('starter handling never bypasses blocked requests, warranty context or unknown product evidence',async()=>{
 const prompt=copy.SE.prompts.tiles;
 const blocked=createChatPipeline({gate:async()=>({filtered:true})});
 assert.equal((await blocked({body:{text:prompt,lang:'SE'},headers:{}})).via,'FILTER');
 const chat=createChatPipeline({gate:async()=>({filtered:false}),knowledge:async()=>({status:'ready',data:{SE:[{question:'Other synthetic FAQ',answer:'Unapproved',evidence:{approvalStatus:'pending'}}]}}),website:async()=>({status:'disabled'}),ai:async()=>{throw Error('must not call');}});
 const warranty=await chat({body:{text:'Och hur många år?',lang:'SE',routingContext:'warranty'},headers:{}});
 assert.equal(warranty.via,'CONTACT');assert.equal(warranty.routingContext,'warranty');
 const named=await chat({body:{text:prompt+' Meteo Salt R-klassning?',lang:'SE'},headers:{}});
 assert.equal(named.via,'CONTACT');assert.notEqual(named.factStatus,'clarification');
});
