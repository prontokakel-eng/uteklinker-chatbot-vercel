import test from 'node:test';
import assert from 'node:assert/strict';
import {createSnapshotLoader,sealSnapshot,openSnapshot,snapshotScope} from '../lib/knowledge-snapshot.js';
import {createKnowledgeCache} from '../lib/drive-knowledge.js';
const env={VERCEL_ENV:'preview',AI_DIALOGUE_ENABLED:'true',GCP_PRIVATE_KEY:'synthetic-key',VERCEL_GIT_COMMIT_SHA:'synthetic-build',FAQ_DRIVE_FILE_IDS:'synthetic-source'};
const knowledge={data:{SE:[],DA:[],DE:[],EN:[]},versions:[]};
test('separate instances reuse a signed private snapshot without extending its original freshness window',async()=>{
 let now=1000,loads=0;const data=new Map(),writes=[];
 const store={read:async name=>data.get(name),write:async(name,value)=>data.set(name,structuredClone(value))};
 const options={env,store,now:()=>now,loader:async()=>{loads++;return knowledge;},defer:p=>writes.push(p)};
 assert.equal((await createSnapshotLoader(options)()).storage,'google');await Promise.all(writes);
 now=200000;
 const memory=createKnowledgeCache({now:()=>now,loader:createSnapshotLoader(options)});
 assert.equal((await memory()).storage,'private_snapshot');assert.equal(loads,1);
 now=301001;
 assert.equal((await memory()).storage,'google');assert.equal(loads,2,'reading a cache must not restart the 5 minute TTL');
});
test('tampering, wrong source/build scope, expiration and extended expiry cannot authorize a snapshot',()=>{
 const scope=snapshotScope(env),payload={schema:1,scope,createdAt:1000,expiresAt:301000,knowledge};
 const signed=sealSnapshot(payload,env.GCP_PRIVATE_KEY),open=value=>openSnapshot(value,{scope,key:env.GCP_PRIVATE_KEY,now:2000,ttlMs:300000});
 assert.ok(open(signed));
 const modified=structuredClone(signed);modified.payload.knowledge.data.SE.push({answer:'unapproved edit'});assert.equal(open(modified),null);
 assert.equal(open(sealSnapshot({...payload,scope:'other-source'},env.GCP_PRIVATE_KEY)),null);
 assert.equal(open(sealSnapshot({...payload,expiresAt:999999},env.GCP_PRIVATE_KEY)),null);
 assert.equal(openSnapshot(signed,{scope,key:env.GCP_PRIVATE_KEY,now:301001,ttlMs:300000}),null);
 assert.notEqual(snapshotScope({...env,VERCEL_GIT_COMMIT_SHA:'new-build'}),scope);
});
test('expired cache plus unavailable source fails closed; Production never touches Preview snapshots',async()=>{
 let reads=0;
 const loader=async()=>{throw Error('Source unavailable');};
 const cached=createKnowledgeCache({loader:createSnapshotLoader({env,store:{read:async()=>{reads++;return null;}},loader,defer(){}})});
 assert.equal((await cached()).status,'error');assert.equal(reads,1);
 let productionReads=0;
 const production=createSnapshotLoader({env:{...env,VERCEL_ENV:'production'},store:{read:()=>productionReads++},loader:async()=>knowledge});
 assert.deepEqual(await production(),knowledge);assert.equal(productionReads,0);
});
