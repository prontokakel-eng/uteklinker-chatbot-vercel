import {approvedFact} from './knowledge-policy.js';
// This is an editorial source, not a view of AI_REVIEW. Approval binds the
// final standalone text and source identity. Drafts retain origin=ai elsewhere.
export function mergeCuratedFaq(data,rows=[]) {
  const counts=new Map();for(const row of rows)counts.set(row.evidence?.sourceId,(counts.get(row.evidence?.sourceId)||0)+1);
  const curated=rows.filter(row=>row.lang==='SE' && row.evidence?.origin==='manual'
    && /^curated:SE:[a-z0-9-]+:v\d+$/u.test(row.evidence?.sourceId || '')
    && /^FAQ_SE_CURATED!\d+$/u.test(row.evidence?.location || '')
    && counts.get(row.evidence.sourceId)===1 && approvedFact(row)).map(row=>({...row,curated:true}));
  return {...data,SE:[...(data.SE || []),...curated]};
}
export function exactCuratedFaq(hit) {
  return hit?.curated===true && hit.score===0 && hit.evidence?.origin==='manual' && approvedFact(hit);
}
