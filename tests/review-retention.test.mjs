import test from 'node:test';
import assert from 'node:assert/strict';
import { planReviewRetention, previewReviewRetention } from '../lib/review-retention.js';
import { REVIEW_HEADERS } from '../lib/ai-review-store.js';

const now = new Date('2026-10-29T12:00:00Z');
test('retention proposal uses strict cutoff and preserves original row numbers across gaps', () => {
  const result = planReviewRetention({days:30, now,
    timestamps:[['2026-09-29T11:59:59Z'],[],['2026-09-29T12:00:00Z'],['2026-01-01T00:00:00Z'],['bad'],['2026-11-01T00:00:00Z'],['2026-02-30T00:00:00Z']],
    origins:[['ai'],[],['ai'],['manual'],['ai'],['ai'],['ai']]});
  assert.deepEqual(result.candidateRows,[2]);
  assert.deepEqual(result.invalidDateRows,[6,8]);
  assert.deepEqual(result.futureDateRows,[7]);
  assert.equal(result.otherRows,1); assert.equal(result.dryRun,true);
  assert.throws(()=>planReviewRetention({timestamps:[],origins:[],now}),/explicitly/);
});
test('retention reader requests schema, timestamps and origin only; refuses unknown schema', async () => {
  const calls=[];
  const sheets={spreadsheets:{values:{get:async ({range})=>{
    calls.push(range); return {data:{values:range.endsWith('A1:O1')?[REVIEW_HEADERS]:range.endsWith('A2:A')?[['2026-01-01T00:00:00Z']]:[['ai']]}};
  }}}};
  const result=await previewReviewRetention({sheets,spreadsheetId:'synthetic',days:30,now});
  assert.deepEqual(calls,["'AI_REVIEW'!A1:O1","'AI_REVIEW'!A2:A","'AI_REVIEW'!I2:I"]);
  assert.deepEqual(result.candidateRows,[2]);
  await assert.rejects(previewReviewRetention({sheets,days:30,now}),/explicit/);
  sheets.spreadsheets.values.get=async()=>({data:{values:[['wrong']]}});
  await assert.rejects(previewReviewRetention({sheets,spreadsheetId:'synthetic',days:30,now}),/schema/);
});
