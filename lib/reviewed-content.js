import { createHash } from 'node:crypto';

// Bind approval to the reviewed text, language and source identity. Never compute
// this during import to silently approve edited rows; a reviewer supplies column K.
export function reviewedContentHash(row) {
  const e = row.evidence || {};
  const values = [row.lang, row.question, row.answer,
    e.sourceId, e.source, e.location, e.date, e.origin, e.factClass];
  return createHash('sha256').update(JSON.stringify(values.map(v => v ?? ''))).digest('hex');
}

export function reviewedContentMatches(row) {
  const hash = row?.evidence?.reviewedContentHash;
  return typeof hash === 'string' && /^[a-f0-9]{64}$/u.test(hash)
    && hash === reviewedContentHash(row);
}
