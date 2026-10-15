import test from 'node:test';
import assert from 'node:assert/strict';
import { supportOpenNow, supportHoursNote } from '../lib/support-hours.js';
import { contactState, getStoreContact } from '../lib/store-contact.js';

// Test schedule only; these weekdays are not a confirmed business configuration.
const weekly={1:[['10:00','17:00']],2:[['10:00','17:00']],3:[['10:00','17:00']],4:[['10:00','17:00']],5:[['10:00','17:00']],6:[],7:[]};
const env={SUPPORT_HOURS_VERIFIED:'true',SUPPORT_HOURS_JSON:JSON.stringify({weekly}),CONTACT_PHONE_VERIFIED:'true',CONTACT_PHONE:'+4640466460',LIVE_CHAT_URL:'https://example.com/chat'};
const at=(iso, overrides={})=>supportOpenNow({env:{...env,...overrides},now:new Date(iso)});

test('support opens at 10 and closes at 17 Stockholm time, including winter',()=>{
 assert.equal(at('2026-10-15T07:59:59Z'),false);
 assert.equal(at('2026-10-15T08:00:00Z'),true);
 assert.equal(at('2026-10-15T14:59:59Z'),true);
 assert.equal(at('2026-10-15T15:00:00Z'),false);
 assert.equal(at('2026-12-15T08:59:59Z'),false);
 assert.equal(at('2026-12-15T09:00:00Z'),true);
 assert.equal(at('2026-10-17T10:00:00Z'),false);
});
test('support date exceptions override the weekly schedule',()=>{
 const override={SUPPORT_HOURS_JSON:JSON.stringify({weekly,exceptions:{'2026-10-15':[],'2026-10-17':[['11:00','12:00']]}})};
 assert.equal(at('2026-10-15T10:00:00Z',override),false);
 assert.equal(at('2026-10-17T09:00:00Z',override),true);
});
test('verified Google support snapshot uses Friday 16:00 and expires safely',()=>{
 const open=iso=>supportOpenNow({env:{},now:new Date(iso)});
 assert.equal(open('2026-10-16T13:59:59Z'),true);
 assert.equal(open('2026-10-16T14:00:00Z'),false);
 assert.equal(open('2026-10-19T08:00:00Z'),true);
 assert.equal(open('2026-10-17T08:00:00Z'),false);
 assert.equal(open('2026-10-29T10:00:00Z'),null);
});
test('unverified, missing and malformed support hours stay unknown',()=>{
 for(const change of [{SUPPORT_HOURS_VERIFIED:'false'},{SUPPORT_HOURS_JSON:''},{SUPPORT_HOURS_JSON:'{}'},
  {SUPPORT_HOURS_JSON:JSON.stringify({weekly:{...weekly,1:[['17:00','10:00']]}})},
  {SUPPORT_HOURS_JSON:JSON.stringify({weekly:{...weekly,1:[['10:00','25:00']]}})}]) assert.equal(at('2026-10-15T10:00:00Z',change),null);
});
test('support hours are displayed in all four languages and removed when expired or overridden',()=>{
 const now=new Date('2026-10-15T10:00:00Z');
 for(const lang of ['SE','DA','DE','EN']) assert.match(supportHoursNote({env:{},lang,now}),/10.*16/);
 assert.equal(supportHoursNote({env,now}),null);
 assert.equal(supportHoursNote({env:{},now:new Date('2026-10-29T10:00:00Z')}),null);
});
test('phone and human chat close with support even when the store is open',()=>{
 const place={currentOpeningHours:{openNow:true}};
 for(const lang of ['SE','DA','DE','EN']) {
  const state=contactState({place,env,staffAvailable:true,lang,now:new Date('2026-10-15T15:00:00Z')});
  assert.equal(state.supportOpenNow,false);assert.equal(state.openNow,true);
  assert.deepEqual(state.links,[]);assert.equal(state.staffAvailable,false);
 }
});
test('real presence is checked during support hours even when Google is unavailable',async()=>{
 let calls=0;
 const config={...env,LIVE_CHAT_PRESENCE_URL:'https://example.com/presence'};
 const fetcher=async()=>{calls++;return {ok:true,json:async()=>({available:true})};};
 const state=await getStoreContact({env:config,fetcher,now:new Date('2026-10-15T10:00:00Z')});
 assert.equal(state.openNow,null);assert.equal(state.staffAvailable,true);assert.equal(calls,1);
 assert.deepEqual(state.links.map(link=>link.type),['phone','chat']);
 await getStoreContact({env:config,fetcher,now:new Date('2026-10-15T15:00:00Z')});
 assert.equal(calls,1);
});
