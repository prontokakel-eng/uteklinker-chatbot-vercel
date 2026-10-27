import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {waitUntil} from '@vercel/functions';
import {privateObjectStore} from './google-json.js';
import {timeStage,latencyMeta} from './latency.js';
import {approvedLegacyHashes} from './legacy-faq-approvals.js';
import {supersededPreviewFaqHashes} from './preview-faq-revisions.js';
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export function snapshotScope(env) {
  return digest({schema:1,environment:env.VERCEL_ENV,commit:env.VERCEL_GIT_COMMIT_SHA || 'local',
    sources:env.FAQ_DRIVE_FILE_IDS || env.SHEET_ID_MAIN || env.SHEET_ID || '',editorial:env.SHEET_ID_MAIN || env.SHEET_ID || '',
    approval:digest([...approvedLegacyHashes].sort()),superseded:[...supersededPreviewFaqHashes].sort()});
}
function signature(payload,key){return createHmac('sha256',key).update(JSON.stringify(payload)).digest('hex');}
export function sealSnapshot(payload,key){return {payload,signature:signature(payload,key)};}
export function openSnapshot(envelope,{scope,key,now,ttlMs}) {
  const payload=envelope?.payload,sig=envelope?.signature;
  if(!payload || payload.schema!==1 || payload.scope!==scope || typeof sig!=='string' || !/^[a-f0-9]{64}$/u.test(sig))return null;
  if(JSON.stringify(envelope).length>5*1024*1024 || !timingSafeEqual(Buffer.from(sig,'hex'),Buffer.from(signature(payload,key),'hex')))return null;
  if(!Number.isFinite(payload.createdAt) || payload.createdAt>now || !Number.isFinite(payload.expiresAt) || payload.expiresAt<=now || payload.expiresAt>payload.createdAt+ttlMs)return null;
  if(!payload.knowledge?.data || !['SE','DA','DE','EN'].every(l=>Array.isArray(payload.knowledge.data[l])))return null;
  return {...payload.knowledge,sourceLoadedAt:payload.createdAt,expiresAt:payload.expiresAt,storage:'private_snapshot'};
}
export function createSnapshotLoader({loader,env=process.env,store,now=Date.now,ttlMs=300000,defer=waitUntil}={}) {
  const scope=snapshotScope(env),name=`faq-snapshots/${scope}.json`;
  const key=(env.GCP_PRIVATE_KEY || env.GOOGLE_SERVICE_ACCOUNT_KEY || '').trim().replace(/\\n/gu,'\n');
  const enabled=env.VERCEL_ENV==='preview' && env.AI_DIALOGUE_ENABLED==='true' && env.FAQ_FAST_CACHE_ENABLED!=='false' && !!key;
  let objects=store;
  return async()=>{
    if(!enabled)return loader();
    try{
      objects ||= privateObjectStore(env);
      const saved=await timeStage('snapshot_read',()=>objects.read(name));
      const opened=openSnapshot(saved,{scope,key,now:now(),ttlMs});
      if(opened){latencyMeta({knowledgeStorage:'private_snapshot',knowledgeAgeMs:now()-opened.sourceLoadedAt});return opened;}
    }catch{/* Cache is optional; a failed read never authorizes stale facts. */}
    latencyMeta({knowledgeStorage:'google'});
    const createdAt=now(),knowledge=await loader();
    const next={...knowledge,sourceLoadedAt:createdAt,expiresAt:createdAt+ttlMs,storage:'google'};
    if(objects){
      const save=timeStage('snapshot_write',()=>objects.write(name,sealSnapshot({schema:1,scope,createdAt,expiresAt:next.expiresAt,knowledge},key)))
        .catch(()=>console.warn(JSON.stringify({event:'faq-snapshot-write-failed'})));
      defer(save);
    }
    return next;
  };
}
