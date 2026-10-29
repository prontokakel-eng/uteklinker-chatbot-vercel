import test from 'node:test';import assert from 'node:assert/strict';
import {mergeCuratedFaq,exactCuratedFaq} from '../lib/curated-faq.js';
import {syntheticRow,syntheticEvidence} from './fixtures/approved-synthetic.mjs';
import {answerDialogue} from '../lib/dialogue-ai.js';
const make=()=>syntheticRow({lang:'SE',question:'Vad betyder bärighet?',answer:'Bärighet beskriver förmågan att bära belastning.',evidence:{...syntheticEvidence,origin:'manual',sourceId:'curated:SE:definition:v1',location:'FAQ_SE_CURATED!2'}});
test('only exact reviewed editorial versions enter the factual collection, never raw AI or edited copies',()=>{
 const row=make();assert.equal(mergeCuratedFaq({SE:[]},[row]).SE.length,1);
 for(const changed of [{...row,answer:'changed'},{...row,provenance:'AI cache'},
  {...row,evidence:{...row.evidence,origin:'ai'}},{...row,evidence:{...row.evidence,approvalStatus:'pending'}}])assert.equal(mergeCuratedFaq({SE:[]},[changed]).SE.length,0);
 assert.equal(mergeCuratedFaq({SE:[]},[row,row]).SE.length,0,'duplicate identities are ambiguous');
});
test('a policy-sensitive term can use its exact reviewed definition, while mixed requests still reach Sol',async()=>{
 const row=mergeCuratedFaq({SE:[]},[make()]).SE[0];
 assert.equal(exactCuratedFaq({...row,score:0}),true);assert.equal(exactCuratedFaq({...row,score:.01}),false);
 let calls=0;
 const client={responses:{create:async()=>{calls++;throw Object.assign(new Error('no external call'),{status:401});}}};
 const run=question=>answerDialogue({question,lang:'SE',forceDialogue:true,knowledge:async()=>({status:'ready',data:{SE:[row]}}),client});
 assert.equal((await run(row.question)).via,'faq');assert.equal(calls,0);
 assert.equal((await run('Vad betyder bärighet och hur många fötter behöver min altan?')).via,'AI_ERROR');assert.equal(calls,1);
});
