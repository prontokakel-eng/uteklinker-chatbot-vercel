import { createHash } from 'node:crypto';
import { reviewedContentHash } from './reviewed-content.js';
import { approvedLegacyHashes } from './legacy-faq-approvals.js';

// One-time restoration of an explicitly reconfirmed human review. This registry
// contains digests only, never customer questions, source text or private IDs.
export function legacyReviewFingerprint(row) {
  return createHash('sha256').update(JSON.stringify([
    row.lang, row.question, row.answer, row.provenance, row.evidence,
  ].map(value => value ?? ''))).digest('hex');
}

export function restoreLegacyReview(row, approved = approvedLegacyHashes) {
  // Modification time is observational, not part of the reviewed content.
  const original = { ...row, evidence: { ...row.evidence, modifiedTime: null } };
  if (row.evidence?.approvalStatus !== 'pending'
    || !approved.has(legacyReviewFingerprint(original))) return row;
  const restored = { ...row, provenance: 'manual', evidence: {
    ...row.evidence, legacyOrigin: row.evidence.origin,
    legacyProvenance: row.provenance,
    origin: 'manual', approvalStatus: 'approved', approvedBy: 'business-owner',
    date: '2026-10-26', factClass: 'static',
    reviewDecision: 'legacy-faq-reconfirmed-2026-10-26',
  } };
  restored.evidence.reviewedContentHash = reviewedContentHash(restored);
  return restored;
}
