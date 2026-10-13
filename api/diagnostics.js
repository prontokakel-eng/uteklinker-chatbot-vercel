import { getKnowledge } from '../lib/drive-knowledge.js';
import { answerCustomer } from '../lib/customer-ai.js';
let ranAI = false;
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (process.env.VERCEL_ENV !== 'preview') return res.status(404).json({error:'Not found'});
  if (req.method !== 'POST') return res.status(405).json({error:'Method Not Allowed'});
  const knowledge = await getKnowledge();
  const result = { data: {status:knowledge.status, counts:Object.fromEntries(['SE','DA','DE','EN'].map(l=>[l,knowledge.data?.[l]?.length || 0]))}, ai:{status:'not_tested'} };
  // One synthetic AI call per function instance, bounded in tokens and timeout.
  if (!ranAI) {
    ranAI = true;
    try {
      const reply = await answerCustomer({question:'Förklara med en mening vad granitkeramik är.',lang:'SE'});
      result.ai = {status:'ok',reply};
    } catch(e) {
      result.ai = {status:'error',httpStatus:Number(e.status)||null,code:typeof e.code==='string'?e.code:null};
    }
  } else result.ai = {status:'already_tested'};
  return res.status(200).json(result);
}
