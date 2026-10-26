import { getKnowledge } from '../lib/drive-knowledge.js';
import { answerCustomer } from '../lib/customer-ai.js';
import { answerDialogue, modelTrace, aiFailure } from '../lib/dialogue-ai.js';
import { getOpenAIClient } from '../lib/openai-client.js';
import { checkRateLimit } from '../lib/rate-limiter.js';
import { approvedFact } from '../lib/knowledge-policy.js';
let ranAI = false;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.VERCEL_ENV !== 'preview') return res.status(404).json({error:'Not found'});
  if (req.method !== 'POST') return res.status(405).json({error:'Method Not Allowed'});
  const ip=String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'anon').split(',')[0].trim();
  const rate=await checkRateLimit(ip);
  if(rate.limited) return res.status(429).json({error:'Rate limited'});
  const knowledge = await getKnowledge();
  const result = { data: {status:knowledge.status, counts:Object.fromEntries(['SE','DA','DE','EN'].map(l=>[l,knowledge.data?.[l]?.length || 0])),
    approvedCounts:Object.fromEntries(['SE','DA','DE','EN'].map(l=>[l,(knowledge.data?.[l] || []).filter(r=>approvedFact(r)).length]))}, ai:{status:'not_tested'} };
  if(req.body?.mode==='sources') return res.status(200).json(result);
  // One synthetic AI call per function instance, bounded in tokens and timeout.
  if (!ranAI) {
    ranAI = true;
    const trace=[];
    const client={responses:{create:async(...args)=>{const response=await getOpenAIClient().responses.create(...args);trace.push(modelTrace(response));return response;}}};
    try {
      const reply = await answerCustomer({question:'Vad är granitkeramik?',lang:'SE',refine:true,
        conversation:[{role:'user',content:'Vad är granitkeramik?'},{role:'assistant',content:'Granitkeramik är ett tätt keramiskt material.'}],client});
      result.ai = {status:'ok',reply,trace};
    } catch(e) {
      result.ai = {status:'error',reason:aiFailure(e),httpStatus:Number(e.status)||null,trace};
    }
    if(process.env.AI_DIALOGUE_ENABLED==='true') {
      const candidateTrace=[];
      const candidate=await answerDialogue({question:'Vad är granitkeramik?',lang:'SE',
        knowledge:async()=>({status:'ready',data:{SE:[]}}),website:async()=>({status:'disabled'}),catalog:async()=>({status:'disabled'}),
        onTrace:t=>candidateTrace.push(t)});
      result.dialogue={status:candidate.via,reply:candidate.reply,diagnosticCode:candidate.diagnosticCode || null,trace:candidateTrace};
    }
  } else result.ai = {status:'already_tested'};
  return res.status(200).json(result);
}
