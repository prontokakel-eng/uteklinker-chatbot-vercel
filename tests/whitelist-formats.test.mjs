import test from 'node:test';
import assert from 'node:assert/strict';
import { gateMessage } from '../lib/gate.js';

test('known dimension formats pass whitelist before gibberish',async()=>{
  for(const text of ['60x60cm','60 × 60 cm','600x600mm']) {
    const result=await gateMessage(text,'203.0.113.181');
    assert.equal(result.filtered,false,text);assert.equal(result.via,'whitelist',text);
  }
});
test('a known format cannot bypass blacklist, repetition or rate limit',async()=>{
  assert.equal((await gateMessage('Hej casino 60x60cm','203.0.113.182')).via,'blacklist');
  assert.equal((await gateMessage('casino60x60cm','203.0.113.182')).filtered,true);
  assert.equal((await gateMessage('60x60cm '.repeat(80),'203.0.113.183')).filtered,true);
  for(let i=0;i<10;i++)assert.equal((await gateMessage('60x60cm','203.0.113.184')).filtered,false);
  assert.equal((await gateMessage('60x60cm','203.0.113.184')).via,'rate-limit');
});
