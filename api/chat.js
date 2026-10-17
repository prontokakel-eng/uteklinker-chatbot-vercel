import { chatPipeline } from '../lib/chatPipeline.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  const reqId = crypto.randomUUID();
  try {
    const result = await chatPipeline(req);
    if (result.retryAfter) res.setHeader('Retry-After', String(result.retryAfter));
    // Keep private Drive IDs/reviewer names server-side; review harness calls the pipeline directly.
    const { evidence, ...publicResult } = result;
    return res.status(result.via === 'rate-limit' ? 429 : 200).json({ ...publicResult, source: result.via === 'faq' ? 'FAQ' : result.via, reqId });
  } catch {
    return res.status(500).json({ source: 'ERROR', reply: 'Ett fel uppstod. Försök igen eller använd kontaktalternativen.', reqId });
  }
}
