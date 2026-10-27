import test from 'node:test';
import assert from 'node:assert/strict';
import {dialogueEnabled,dialogueReviewMode,editorialRevisionsEnabled} from '../lib/dialogue-config.js';
import {createChatPipeline} from '../lib/chatPipeline.js';
const preview={VERCEL_ENV:'preview',AI_DIALOGUE_ENABLED:'true'};
test('Production requires both server switches; rollback disables the controller while retaining approved editorial corrections',()=>{
 assert.equal(dialogueEnabled(preview),true);
 for(const env of [{},{...preview,VERCEL_ENV:'development'},{...preview,VERCEL_ENV:'production'},
  {...preview,VERCEL_ENV:'production',AI_DIALOGUE_RELEASE_ENABLED:'false'},
  {...preview,VERCEL_ENV:'production',AI_DIALOGUE_ENABLED:'false',AI_DIALOGUE_RELEASE_ENABLED:'true'}])assert.equal(dialogueEnabled(env),false);
 assert.equal(dialogueEnabled({...preview,VERCEL_ENV:'production',AI_DIALOGUE_RELEASE_ENABLED:'true'}),true);
 assert.equal(editorialRevisionsEnabled({...preview,VERCEL_ENV:'production',AI_DIALOGUE_RELEASE_ENABLED:'false'}),true);
 assert.equal(editorialRevisionsEnabled({VERCEL_ENV:'production'}),false);
});
test('Production always keeps separate review regardless of a client experiment flag',async()=>{
 assert.equal(dialogueReviewMode(preview,'single'),'inline');
 const env={...preview,VERCEL_ENV:'production',AI_DIALOGUE_RELEASE_ENABLED:'true'};
 assert.equal(dialogueReviewMode(env,'single'),'separate');
 let args;const chat=createChatPipeline({env,gate:async()=>({filtered:false}),dialogue:async a=>{args=a;return {via:'AI',reply:'Syntetiskt svar'};}});
 const result=await chat({body:{text:'Vad betyder bärighet?',lang:'SE',experiment:'single'},headers:{}});
 assert.equal(result.via,'AI');assert.equal(args.reviewMode,'separate');assert.equal(args.forceDialogue,true);
});
