import { createHash } from 'node:crypto';

// Offline review records ONLY: no network writer or automatic promotion API.
export function createAiReviewDraft({ lang, question, answer, sourceReferences = [],
  model = null, responseId = null, checks = {}, testedAt = null } = {}) {
  if (!['SE', 'DA', 'DE', 'EN'].includes(lang)
    || typeof question !== 'string' || !question.trim() || question.length > 4000
    || typeof answer !== 'string' || !answer.trim() || answer.length > 20000
    || !Array.isArray(sourceReferences)) throw new Error('Invalid private review draft');
  const draftHash = createHash('sha256').update(JSON.stringify([lang, question, answer, sourceReferences])).digest('hex');
  return {
    draftId: `ai-draft:${draftHash}`, draftHash, lang, question, answer,
    sourceReferences, model, responseId, testedAt, checks,
    provenance: 'generated',
    evidence: { origin: 'ai', sourceId: `ai-draft:${draftHash}`, source: 'AI draft',
      approvalStatus: 'pending', approvedBy: '', date: '', location: 'AI_REVIEW',
      factClass: 'unverified', reviewedContentHash: '' },
    factReview: 'pending', languageReview: 'pending', humanDecision: 'pending',
    reviewer: '', reviewedAt: '', correctedAnswer: '', verifiedPrimarySource: '',
    productionApproved: false,
  };
}
