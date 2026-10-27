import test from 'node:test';
import assert from 'node:assert/strict';
import {parseAnswerReview} from '../lib/dialogue-review.js';
import {syntheticRow,syntheticEvidence} from './fixtures/approved-synthetic.mjs';
const row=syntheticRow({question:'Vilken färg?',answer:'Testplattan har en ljusgrå ton.',evidence:syntheticEvidence});
const verdict={decision:'allow',reason:'none',needsEvidence:true,evidence:[{sourceId:row.evidence.sourceId,quote:'har en ljusgrå ton'}]};
const response=value=>({status:'completed',output:[{type:'function_call',name:'review_answer',arguments:JSON.stringify(value)}]});
test('semantic approval still needs exact quotations from the candidate cited server sources',()=>{
 assert.deepEqual(parseAnswerReview(response(verdict),[row]),verdict);
 for(const evidence of [[],[{sourceId:'forged-id',quote:'har en ljusgrå ton'}],[{sourceId:row.evidence.sourceId,quote:'är frostbeständig'}]]) {
  assert.equal(parseAnswerReview(response({...verdict,evidence}),[row]),null);
 }
 assert.equal(parseAnswerReview(response(verdict),[]),null,'a genuine but uncited source cannot authorize the answer');
});
test('partial, malformed or ambiguous review responses fail closed',()=>{
 for(const value of [null,{...response(verdict),status:'incomplete'},{...response(verdict),output:[]},
  {...response(verdict),output:[...response(verdict).output,...response(verdict).output]},response({...verdict,decision:'maybe'}),
  response({...verdict,reason:'unsupported_fact'}),response({...verdict,needsEvidence:'false'}),
  response({...verdict,evidence:[{sourceId:row.evidence.sourceId,quote:''}]}),
 ])assert.equal(parseAnswerReview(value,[row]),null);
});
