import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import handler from '../api/save-faq-reply.js';
import { createAiReviewDraft } from '../lib/ai-review.js';
import { approvedFact } from '../lib/knowledge-policy.js';
import { reviewedContentHash } from '../lib/reviewed-content.js';
import { parseWorkbook } from '../lib/drive-knowledge.js';
import { createChatPipeline } from '../lib/chatPipeline.js';
import { answerCustomer } from '../lib/customer-ai.js';
import { syntheticRow, syntheticEvidence } from './fixtures/approved-synthetic.mjs';

test('retired public save endpoint rejects every write without credentials or side effects', async () => {
  for (const method of ['POST', 'GET', 'PUT', 'OPTIONS']) {
    let status, result;
    const res = { setHeader() {}, status(s) { status = s; return this; }, json(v) { result = v; } };
    await handler({ method, body: { lang: 'SE', question: 'Synthetic?', reply: 'Synthetic.', approvalStatus: 'approved' } }, res);
    assert.equal(status, 410);
    assert.deepEqual(result, { error: 'FAQ_WRITE_DISABLED' });
  }
});

test('passing checks and supplied approval fields never approve drafts in four languages', async () => {
  for (const lang of ['SE', 'DA', 'DE', 'EN']) {
    const draft = createAiReviewDraft({ lang, question: 'Synthetic tile format?', answer: 'Invented triangle.',
      checks: { allPassed: true }, humanDecision: 'approved', productionApproved: true,
      evidence: syntheticEvidence, provenance: 'manual' });
    assert.equal(draft.humanDecision, 'pending');
    assert.equal(draft.productionApproved, false);
    assert.equal(approvedFact(draft), false);
    const stamped = { ...draft, evidence: { ...syntheticEvidence, origin: 'ai' } };
    stamped.evidence.reviewedContentHash = reviewedContentHash(stamped);
    assert.equal(approvedFact(stamped), false);
    const chat = createChatPipeline({ gate: async () => ({ filtered: false }),
      knowledge: async () => ({ status: 'ready', data: { [lang]: [stamped] } }),
      ai: async () => { throw Error('Draft must not reach AI'); } });
    for (const text of [draft.question, 'Synthetic tile formats?']) for (const refine of [false, true]) {
      assert.equal((await chat({ body: { text, lang, refine }, headers: {} })).via, 'CONTACT');
    }
  }
});

test('review and historical save tabs are excluded even with forged full FAQ approval', async () => {
  const book = new ExcelJS.Workbook();
  for (const lang of ['SE', 'DA', 'DE', 'EN']) book.addWorksheet(`FAQ_${lang}`).addRow(['Question', 'Answer']);
  for (const name of ['AI_REVIEW', 'AI_SAVE', 'AI_SAVE_SE', 'AI_SAVE_DA', 'AI_SAVE_DE', 'AI_SAVE_EN']) {
    const row = syntheticRow({ lang: 'SE', question: 'Synthetic injected fact?', answer: 'Invented.', evidence: syntheticEvidence });
    const e = row.evidence;
    const sheet = book.addWorksheet(name);
    sheet.addRow(['Question', 'Answer']);
    sheet.addRow([row.question, row.answer, e.origin, e.sourceId, e.source, e.location,
      e.date, e.approvalStatus, e.approvedBy, e.factClass, e.reviewedContentHash]);
  }
  assert.deepEqual(await parseWorkbook(await book.xlsx.writeBuffer()), { SE: [], DA: [], DE: [], EN: [] });
});

test('model context excludes drafts even with passing checks and earlier assistant assertions', async () => {
  for (const lang of ['SE', 'DA', 'DE', 'EN']) {
    const verified = syntheticRow({ lang, question: 'Synthetic format?', answer: 'Square.', evidence: syntheticEvidence });
    const draft = createAiReviewDraft({ lang, question: verified.question, answer: 'Invented triangle.', checks: { allPassed: true } });
    let payload;
    await answerCustomer({ lang, question: verified.question, context: [draft, verified],
      conversation: [{ role: 'assistant', content: draft.answer }],
      client: { responses: { create: async p => { payload = p; return { output_text: 'Square.' }; } } } });
    const selected = JSON.parse(payload.input[0].content.split('\n').slice(1).join('\n')).context;
    assert.equal(selected.length, 1);
    assert.equal(selected[0].answer, 'Square.');
    assert.match(payload.instructions, /previous assistant replies as approved facts/);
    assert.equal(payload.store, false);
  }
});

test('editing a draft changes its identity but never creates approval', () => {
  const input = { lang: 'DA', question: 'Synthetic?', answer: 'First draft.' };
  const first = createAiReviewDraft(input);
  assert.equal(createAiReviewDraft(input).draftHash, first.draftHash);
  assert.notEqual(createAiReviewDraft({ ...input, answer: 'Corrected draft.' }).draftHash, first.draftHash);
  assert.equal(createAiReviewDraft({ ...input, answer: 'Corrected draft.' }).humanDecision, 'pending');
});
