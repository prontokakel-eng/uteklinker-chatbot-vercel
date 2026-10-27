import test from 'node:test';
import assert from 'node:assert/strict';
import {applyPreviewFaqRevisions} from '../lib/preview-faq-revisions.js';
import {syntheticRow,syntheticEvidence} from './fixtures/approved-synthetic.mjs';
const base=syntheticRow({question:'Synthetic pool question?',answer:'Synthetic original statement.',evidence:syntheticEvidence});
const retired=new Set([base.evidence.reviewedContentHash]);
const revision=(changes={})=>syntheticRow({...base,answer:'Check the selected product and application.',...changes,evidence:{...base.evidence,
  origin:'manual',date:'2026-10-27',approvedBy:'owner-requested-editorial-review',replacesReviewedContentHash:base.evidence.reviewedContentHash,...changes.evidence}});
test('Preview revisions replace only the exact retired approved source version',()=>{
 const next=revision();const data={SE:[base],EN:[{answer:'Unchanged'}]};
 const out=applyPreviewFaqRevisions(data,[next],retired);
 assert.deepEqual(out.SE,[next]);assert.equal(out.EN,data.EN);assert.deepEqual(data.SE,[base]);
});
test('missing, edited, duplicate or unreviewed revisions never revive a superseded claim',()=>{
 const good=revision();
 for(const rows of [[],[good,good],[{...good,answer:'Unreviewed edit'}],[revision({evidence:{approvalStatus:'pending'}})],
  [revision({evidence:{origin:'ai'}})]])assert.deepEqual(applyPreviewFaqRevisions({SE:[base]},rows,retired).SE,[]);
});
test('revision identity, source, location, language and base hash remain binding',()=>{
 for(const changes of [{question:'Different question?'},{lang:'EN'},{evidence:{sourceId:'different'}},{evidence:{source:'different'}},
  {evidence:{location:'different'}},{evidence:{replacesReviewedContentHash:'0'.repeat(64)}}]) {
  assert.deepEqual(applyPreviewFaqRevisions({SE:[base]},[revision(changes)],retired).SE,[]);
 }
});
test('later base edits and unrelated source rows cannot inherit a Preview revision',()=>{
 const changed=syntheticRow({...base,answer:'Newly reviewed original.'});
 assert.deepEqual(applyPreviewFaqRevisions({SE:[changed]},[revision()],retired).SE,[changed]);
});
