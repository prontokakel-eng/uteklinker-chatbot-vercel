import test from 'node:test';
import assert from 'node:assert/strict';
import { createReviewStore, REVIEW_HEADERS, reviewText } from '../lib/ai-review-store.js';
import { createChatHandler } from '../api/chat.js';

test('AI review uses RAW append to a separate tab with pending status and no approval',async()=>{
  const calls=[];
  const sheets={spreadsheets:{values:{get:async args=>{calls.push(args);return{data:{values:[REVIEW_HEADERS]}};},
    append:async args=>{calls.push(args);return{data:{updates:{updatedRange:'AI_REVIEW!A2:O2'}}};}}}};
  const save=createReviewStore({env:{SHEET_ID:'synthetic-sheet',VERCEL_ENV:'preview'},sheets,now:()=> '2026-10-26T18:00:00Z'});
  const result={via:'AI',lang:'SE',reply:'Synthetic answer.',modelDiagnostics:[{model:'synthetic-model',responseId:'synthetic-response'}]};
  assert.equal((await save({question:'=SUM(A1:A2) user@example.com',result,reqId:'synthetic-request'})).status,'saved');
  const append=calls[1];
  assert.equal(append.range,"'AI_REVIEW'!A:O");assert.equal(append.valueInputOption,'RAW');
  const row=append.requestBody.values[0];
  assert.equal(row[4],'Ej granskat');assert.equal(row[8],'ai');assert.deepEqual(row.slice(9,13),['','','','']);
  assert.equal(row[2],'=SUM(A1:A2) [e-post borttagen]');assert.equal(row[5],'synthetic-model');
  for(const via of ['faq','CONTACT','AI_ERROR','FILTER']) assert.equal((await save({result:{...result,via}})).status,'not-applicable');
  assert.equal(calls.length,2);
});

test('schema failure does not append; email and long personal numbers are redacted',async()=>{
  const save=createReviewStore({env:{SHEET_ID:'synthetic-sheet'},sheets:{spreadsheets:{values:{get:async()=>({data:{values:[['Wrong header']]}}),append:()=>{throw Error('must not append');}}}}});
  await assert.rejects(save({question:'Synthetic',result:{via:'AI'}}),/schema mismatch/);
  assert.doesNotMatch(reviewText('user@example.com 19700101-1234 +46 70 123 45 67'),/example.com|19700101|123 45/);
  assert.equal(reviewText('60x60 cm, 30 m²'),'60x60 cm, 30 m²');
});

test('HTTP chat waits for review write and preserves the answer if storage fails',async()=>{
  for(const fail of [false,true]) {
    const steps=[];let body;
    const handler=createChatHandler({chat:async()=>({via:'AI',lang:'SE',reply:'Synthetic answer',evidence:[{sourceId:'private'}]}),
      saveReview:async args=>{steps.push('save');assert.equal(args.question,'Synthetic question');if(fail)throw Error('storage outage');}});
    const response={setHeader(){},status(){return this;},json(value){steps.push('response');body=value;}};
    await handler({method:'POST',body:{text:'Synthetic question'}},response);
    assert.deepEqual(steps,['save','response']);assert.equal(body.reply,'Synthetic answer');assert.equal(body.evidence,undefined);
  }
});

test('review logging records the customer answer response ID rather than its checking call',async()=>{
 let values;
 const sheets={spreadsheets:{values:{get:async()=>({data:{values:[REVIEW_HEADERS]}}),append:async args=>{values=args.requestBody.values;return {data:{updates:{updatedRange:'AI_REVIEW!A2:O2'}}};}}}};
 const save=createReviewStore({env:{SHEET_ID:'synthetic'},sheets});
 await save({question:'Synthetic?',reqId:'synthetic-request',result:{via:'AI',lang:'SE',reply:'Synthetic.',modelDiagnostics:[
  {model:'synthetic-model',responseId:'answer-response'}, {phase:'review',model:'synthetic-model',responseId:'review-response'},
 ]}});
 assert.equal(values[0][6],'answer-response');assert.equal(values[0][4],'Ej granskat');
});
