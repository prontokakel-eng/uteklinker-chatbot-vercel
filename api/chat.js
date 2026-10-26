import { chatPipeline } from '../lib/chatPipeline.js';
import { saveAiReview } from '../lib/ai-review-store.js';
export function createChatHandler({ chat = chatPipeline, saveReview = saveAiReview } = {}) {
return async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  const reqId = crypto.randomUUID();
  try {
    const result = await chat(req);
    try {
      await saveReview({ question: req.body?.text ?? req.body?.question, result, reqId });
    } catch {
      // Metadata only; a logging outage must not replace the customer's answer.
      console.warn(JSON.stringify({ event: 'ai-review-save-failed', reqId }));
    }
    if (result.retryAfter) res.setHeader('Retry-After', String(result.retryAfter));
    // Keep private Drive IDs/reviewer names server-side; review harness calls the pipeline directly.
    const { evidence, ...publicResult } = result;
    return res.status(result.via === 'rate-limit' ? 429 : 200).json({ ...publicResult, source: result.via === 'faq' ? 'FAQ' : result.via, reqId });
  } catch {
    return res.status(500).json({ source: 'ERROR', reply: 'Ett fel uppstod. Försök igen eller använd kontaktalternativen.', reqId });
  }
}
}
export default createChatHandler();
