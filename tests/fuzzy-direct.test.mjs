import test from 'node:test';
import assert from 'node:assert/strict';
import { answerDialogue } from '../lib/dialogue-ai.js';
import { directKnowledgeHit } from '../lib/drive-knowledge.js';
import { syntheticRow, syntheticEvidence } from './fixtures/approved-synthetic.mjs';

const questions={SE:'Behöver testplattorna behandlas med impregnering?',DA:'Skal testfliserne behandles med imprægnering?',
  DE:'Müssen Testplatten mit Imprägnierung behandelt werden?',EN:'Do test tiles need treatment with impregnation?'};
for(const [lang,question] of Object.entries(questions)) test(`${lang}: spelling and word-order matches answer from FAQ without a model call`,async()=>{
  const faq=syntheticRow({lang,question,answer:'Synthetic approved answer.',evidence:syntheticEvidence});
  const words=question.replace('?','').split(' ');
  const variants=[question.replace(/(impregnering|imprægnering|Imprägnierung|impregnation)/u,s=>s.slice(0,-2)+s.slice(-1)), [...words.slice(-2),...words.slice(0,-2)].join(' ')+'?'];
  for(const variant of variants) {
    const result=await answerDialogue({question:variant,lang,knowledge:async()=>({status:'ready',data:{[lang]:[faq]}}),
      client:{responses:{create(){throw Error('Unexpected model call');}}}});
    assert.equal(result.via,'faq',variant);
    assert.equal(result.reply,faq.answer);
    assert.deepEqual(result.modelDiagnostics,[]);
  }
});

test('ambiguous answers, changed numbers and negations cannot become direct fuzzy answers',()=>{
  const hit={question:'Use 60 mm synthetic tiles?',answer:'Synthetic answer',score:0.1};
  assert.equal(directKnowledgeHit([hit],'Use 80 mm synthetic tiles?'),null);
  assert.equal(directKnowledgeHit([hit],'Do not use 60 mm synthetic tiles?'),null);
  assert.equal(directKnowledgeHit([hit,{...hit,answer:'Conflicting answer',score:0.11}],hit.question),null);
});
