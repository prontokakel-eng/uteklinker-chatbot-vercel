import { approvedFact } from './knowledge-policy.js';

// Exact superseded source versions only. No FAQ text or private source IDs.
export const supersededPreviewFaqHashes = new Set([
  '02a73f7edb4c139df1f72a7c72189ae0a7a2bbca3a06422d60833c27b09419a1',
  '0e2c2aab71753e4be40b10b0d027d88bf6ce4841e27b46d2319f32c0100621f3',
]);
export function applyPreviewFaqRevisions(data, revisions, superseded=supersededPreviewFaqHashes) {
  return {...data,SE:(data.SE || []).flatMap(original=>{
    if(!superseded.has(original.evidence?.reviewedContentHash))return [original];
    if(!approvedFact(original))return [];
    const replacements=revisions.filter(r=>r.lang==='SE' && approvedFact(r)
      && r.evidence.origin==='manual' && r.question===original.question
      && r.evidence.sourceId===original.evidence.sourceId
      && r.evidence.source===original.evidence.source && r.evidence.location===original.evidence.location
      && r.evidence.replacesReviewedContentHash===original.evidence.reviewedContentHash);
    // Missing, edited or conflicting revisions do not resurrect the old claim.
    return replacements.length===1?[replacements[0]]:[];
  })};
}
