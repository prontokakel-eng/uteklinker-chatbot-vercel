import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
import { getWebsiteOpeningHours } from '../lib/website-opening-hours.js';
import { createOpeningHoursHandler } from '../api/opening-hours.js';
const now = new Date('2026-10-26T10:00:00Z');
const closed = {openNow:false, nextOpenTime:'2026-10-28T12:00:00Z'};
const open = {openNow:true, nextCloseTime:'2026-10-26T16:00:00Z'};
const place = {timeZone:{id:'Europe/Stockholm'},currentOpeningHours:closed,currentSecondaryOpeningHours:[{...open,secondaryHoursType:'ONLINE_SERVICE_HOURS'}]};
const response = value => ({status:'ready',place:value,fetchedAt:now.toISOString()});
test('website separates store from support and shares the existing server loader',async()=>{
 let request;
 const data = await getWebsiteOpeningHours({now,lang:'DE',env:{fixture:true},loader:async options=>{request=options;return response(place);}});
 assert.equal(request.lang,'DE');assert.deepEqual(request.env,{fixture:true});
 assert.equal(data.store.openNow,false);assert.equal(data.support.openNow,true);
 assert.equal(data.store.validUntil,'2026-10-26T10:15:00.000Z');
 assert.doesNotMatch(JSON.stringify(data),/API_KEY|fixture|currentSecondaryOpeningHours/);
});
test('unavailable, stale, wrong-timezone and incomplete support never authorize old claims',async()=>{
 for(const result of [{status:'unavailable'}, {...response(place),fetchedAt:'2026-10-26T09:45:00Z'},response({...place,timeZone:{id:'UTC'}})]){
  const data=await getWebsiteOpeningHours({now,loader:async()=>result});
  assert.equal(data.store.openNow,null);assert.equal(data.support.openNow,null);assert.equal(data.source,null);
 }
 const missing=await getWebsiteOpeningHours({now,loader:async()=>response({...place,currentSecondaryOpeningHours:[]})});
 assert.equal(missing.store.openNow,false);assert.equal(missing.support.openNow,null);
});
test('store closing boundary expires its status independently from support',async()=>{
 const data=await getWebsiteOpeningHours({now,loader:async()=>response({...place,currentOpeningHours:{...open,nextCloseTime:'2026-10-26T10:01:00Z'}})});
 assert.equal(data.store.validUntil,'2026-10-26T10:01:00.000Z');assert.equal(data.support.validUntil,'2026-10-26T10:15:00.000Z');
 const invalid=await getWebsiteOpeningHours({now,loader:async()=>response({...place,currentOpeningHours:{openNow:true}})});
 assert.equal(invalid.store.openNow,null);
});
test('opening-hours endpoint allows only exact storefront origins, GET and bounded traffic',async()=>{
 let calls=0,limited=false;
 const handler=createOpeningHoursHandler({load:async()=>{calls++;return {source:null};},rateLimit:async()=>({limited,retryAfter:60})});
 async function run(origin,method='GET'){
  const res={headers:{},setHeader(k,v){this.headers[k]=v;},status(c){this.code=c;return this;},json(d){this.data=d;return this;}};
  await handler({headers:origin?{origin}:{},method,query:{}},res);return res;
 }
 for(const origin of ['https://klinkerdack.se.evil.example','http://klinkerdack.se','null']) assert.equal((await run(origin)).code,403);
 assert.equal(calls,0);assert.equal((await run('https://klinkerdack.se','POST')).code,405);
 const valid=await run('https://klinkerdack.se');assert.equal(valid.code,200);assert.equal(valid.headers['Cache-Control'],'no-store');
 assert.equal(valid.headers['Access-Control-Allow-Origin'],'https://klinkerdack.se');assert.equal(valid.headers['Access-Control-Allow-Credentials'],undefined);
 limited=true;assert.equal((await run()).code,429);assert.equal(calls,1);
});
test('browser renderer uses no credentials or Google scripts and removes expired claims at the boundary',async()=>{
 const script=await fs.readFile(new URL('../public/website-opening-hours.js',import.meta.url),'utf8');
 let clock=now.getTime(), request;const timers=[];
 const nodes=Object.fromEntries(['[data-kd-hours]','[data-kd-support]'].map(s=>[s,{dataset:{}}]));
 const data=await getWebsiteOpeningHours({now,loader:async()=>response({...place,currentOpeningHours:{...open,nextCloseTime:'2026-10-26T10:01:00Z'}})});
 class Clock extends Date{static now(){return clock;}}
 const document={currentScript:{dataset:{},src:'https://preview.example/website-opening-hours.js'},documentElement:{lang:'de'},readyState:'complete',hidden:false,querySelector:s=>nodes[s],addEventListener(){}};
 vm.runInNewContext(script,{document,window:{},URL,Date:Clock,AbortSignal,location:{href:'https://klinkerdack.se/'},setTimeout(fn,ms){timers.push({fn,ms});return timers.length;},clearTimeout(){},fetch:async(url,options)=>{request={url,options};return {ok:true,json:async()=>data};}});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(request.url,'https://preview.example/api/opening-hours?lang=DE');assert.equal(request.options.credentials,'omit');assert.equal(request.options.referrerPolicy,'no-referrer');
 assert.equal(nodes['[data-kd-hours]'].textContent,'Jetzt geöffnet');
 const expiry=timers.find(t=>t.ms===60000);assert.ok(expiry);
 clock+=60000;expiry.fn();assert.equal(nodes['[data-kd-hours]'].dataset.openState,'unknown');
 assert.equal(nodes['[data-kd-support]'].dataset.openState,'open');
 assert.doesNotMatch(script,/maps\.googleapis\.com|importLibrary|createElement\(['"]script/);
});
