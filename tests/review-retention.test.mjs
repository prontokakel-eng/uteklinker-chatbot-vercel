import test from 'node:test';
import assert from 'node:assert/strict';
import { planReviewRetention, previewReviewRetention } from '../lib/review-retention.js';
import { REVIEW_HEADERS } from '../lib/ai-review-store.js';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const now = new Date('2026-10-29T12:00:00Z');
test('retention proposal uses strict cutoff and preserves original row numbers across gaps', () => {
  const result = planReviewRetention({days:30, now,
    timestamps:[['2026-09-29T11:59:59Z'],[],['2026-09-29T12:00:00Z'],['2026-01-01T00:00:00Z'],['bad'],['2026-11-01T00:00:00Z'],['2026-02-30T00:00:00Z']],
    origins:[['ai'],[],['ai'],['manual'],['ai'],['ai'],['ai']]});
  assert.deepEqual(result.candidateRows,[2]);
  assert.deepEqual(result.invalidDateRows,[6,8]);
  assert.deepEqual(result.futureDateRows,[7]);
  assert.equal(result.otherRows,1); assert.equal(result.dryRun,true);
  assert.equal(result.deletionAllowed,false); assert.equal(result.manualReviewRequired,true);
  assert.equal(result.workflowStatus,'awaiting-human-review');
  assert.throws(()=>planReviewRetention({timestamps:[],origins:[],now}),/explicitly/);
});

test('retention CLI blocks apply/delete before credentials or network access', () => {
  const script=fileURLToPath(new URL('../scripts/review-retention-preview.mjs',import.meta.url));
  for(const flag of ['--apply','--delete']) {
    const run=spawnSync(process.execPath,[script,'--sheet-id','synthetic','--days','30',flag],{encoding:'utf8',env:{}});
    assert.equal(run.status,1);
    assert.match(run.stderr,/Deletion blocked: manual review and separate approval/);
    assert.equal(run.stdout,'');
  }
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
