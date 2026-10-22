import { reviewedContentHash } from '../../lib/reviewed-content.js';
// Only synthetic test evidence. Never use to approve imported/live FAQ rows.
export const syntheticEvidence = Object.freeze({
  sourceId: 'synthetic:reviewed:1', source: 'Synthetic reviewed fixture',
  location: 'section 1', date: '2026-01-01', origin: 'faq',
  factClass: 'static', approvalStatus: 'approved', approvedBy: 'synthetic-reviewer',
});
export function syntheticRow(row) {
  const result = { lang: 'SE', ...row, evidence: { ...row.evidence } };
  if (row.evidence) result.evidence.reviewedContentHash = reviewedContentHash(result);
  else result.evidence = row.evidence;
  return result;
}
