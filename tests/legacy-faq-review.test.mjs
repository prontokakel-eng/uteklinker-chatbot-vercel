import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeRows } from '../lib/drive-knowledge.js';
import { legacyReviewFingerprint, restoreLegacyReview } from '../lib/legacy-faq-review.js';
import { approvedFact } from '../lib/knowledge-policy.js';
import { createChatPipeline } from '../lib/chatPipeline.js';

const raw = (lang = 'SE', provenance = '') => normalizeRows([
  ['Synthetic ceramic cleaning?', 'Use a soft brush.', provenance],
], lang, { id: 'synthetic-private-file', name: 'Synthetic reviewed FAQ' })[0];

test('explicit finite review restores original FAQ and individually reviewed translations', async () => {
  for (const lang of ['SE', 'DA', 'DE', 'EN']) {
    const row = raw(lang, lang === 'SE' ? '' : 'AI/Cache');
    const registry = new Set([legacyReviewFingerprint(row)]);
    const reviewed = restoreLegacyReview(row, registry);
    assert.equal(approvedFact(reviewed), true);
    assert.equal(reviewed.evidence.legacyProvenance, row.provenance);
    assert.equal(reviewed.evidence.sourceId, row.evidence.sourceId);
    const chat = createChatPipeline({ gate: async () => ({ filtered: false }),
      knowledge: async () => ({ status: 'ready', data: { [lang]: [reviewed] } }),
      website: async () => ({ status: 'disabled' }),
      ai: async () => { throw Error('Exact FAQ must not call AI'); },
    });
    const result = await chat({ body: { text: row.question, lang }, headers: {} });
    assert.equal(result.via, 'faq');
    assert.equal(result.reply, row.answer);
  }
});

test('changed text, origin, identity, location or review metadata never inherits old approval', () => {
  const row = raw();
  const registry = new Set([legacyReviewFingerprint(row)]);
  for (const candidate of [
    { ...row, question: 'New question' }, { ...row, answer: 'Changed answer' },
    { ...row, lang: 'EN' }, { ...row, provenance: 'AI/Cache' },
    ...['fileId', 'sourceId', 'source', 'location', 'row', 'origin', 'date', 'approvedBy', 'reviewedContentHash'].map(key =>
      ({ ...row, evidence: { ...row.evidence, [key]: 'changed' } })),
    { ...row, evidence: { ...row.evidence, approvalStatus: 'rejected' } },
  ]) {
    assert.equal(restoreLegacyReview(candidate, registry), candidate);
    assert.equal(approvedFact(candidate), false);
  }
  const refreshed = { ...row, evidence: { ...row.evidence, modifiedTime: '2026-10-26T16:00:00Z' } };
  assert.equal(approvedFact(restoreLegacyReview(refreshed, registry)), true);
});

test('unlisted original-looking and AI/cache rows remain pending without an explicit decision', () => {
  for (const origin of ['', 'AI/Cache', 'manual', 'faq']) {
    const row = raw('SE', origin);
    assert.equal(restoreLegacyReview(row), row);
    assert.equal(approvedFact(row), false);
  }
});
