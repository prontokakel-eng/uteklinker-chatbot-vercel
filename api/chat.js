import {withLatency,timeStage,serverTiming} from '../lib/latency.js';
import { chatPipeline } from '../lib/chatPipeline.js';
import { saveAiReview } from '../lib/ai-review-store.js';
let firstRequest=true;
export function createChatHandler({ chat = chatPipeline, saveReview = saveAiReview, env=process.env } = {}) {
return async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  const reqId = crypto.randomUUID();
  const firstRequestInInstance=firstRequest;firstRequest=false;
  return withLatency(async timing=>{
  try {
    const result = await timeStage('chat',()=>chat(req));
    try {
      await timeStage('review_storage',()=>saveReview({ question: req.body?.text ?? req.body?.question, result, reqId }));
    } catch {
      // Metadata only; a logging outage must not replace the customer's answer.
      console.warn(JSON.stringify({ event: 'ai-review-save-failed', reqId }));
    }
    if (result.retryAfter) res.setHeader('Retry-After', String(result.retryAfter));
    // Keep private Drive IDs/reviewer names server-side; review harness calls the pipeline directly.
    const { evidence, modelDiagnostics, diagnosticCode, ...publicResult } = result;
    if(env.VERCEL_ENV==='preview'){
      if(modelDiagnostics)publicResult.modelDiagnostics=modelDiagnostics;
      if(diagnosticCode)publicResult.diagnosticCode=diagnosticCode;
    }
    const performance=timing.snapshot();
    if(env.VERCEL_ENV==='preview'){res.setHeader('Server-Timing',serverTiming(performance));publicResult.performance=performance;}
    return res.status(result.via === 'rate-limit' ? 429 : 200).json({ ...publicResult, source: result.via === 'faq' ? 'FAQ' : result.via, reqId });
  } catch {
    return res.status(500).json({ source: 'ERROR', reply: 'Ett fel uppstod. Försök igen eller använd kontaktalternativen.', reqId });
  }
  },{meta:{firstRequestInInstance}});
}
}
export default createChatHandler();
