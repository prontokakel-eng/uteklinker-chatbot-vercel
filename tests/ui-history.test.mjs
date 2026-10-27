import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('../public/chat-ui.js',import.meta.url),'utf8');
const send=source.slice(source.indexOf('async function sendCore('),source.indexOf('sendBtn?.addEventListener',source.indexOf('async function sendCore(')));

test('real UI requests retain FAQ and contact replies, source labels and earlier corrections for the next turn',async()=>{
  const requests=[],shown=[];
  const replies=[{source:'FAQ',reply:'Ett granskat svar. '.repeat(80)},{source:'CONTACT',reply:'Vi behöver bedöma projektet personligen.'},
    {source:'AI',reply:'Vi kan fortsätta med materialval.'}];
  const sandbox=vm.createContext({AbortSignal,console,lang:'SE',sending:false,sendBtn:null,newChatBtn:null,input:null,
    conversation:[{role:'user',content:'Rättelse: 25 m².'},...Array.from({length:14},(_,i)=>({role:i%2?'user':'assistant',content:'Tidigare ämne.'}))],
    routingContext:null,lastUserText:'',lastBotAnswer:'',navigator:{onLine:true},
    addMessage:(...args)=>shown.push(args),showLoader(){},hideLoader(){},startTypingSound(){},stopTypingSound(){},
    toDisplay:s=>s,uiText:s=>s,
    fetch:async(url,options)=>{requests.push(JSON.parse(options.body));return {status:200,ok:true,headers:{get:()=> 'application/json'},json:async()=>replies.shift()};},
  });
  vm.runInContext(send,sandbox);
  await vm.runInContext("sendCore('Fråga om materialet','SE')",sandbox);
  await vm.runInContext("sendCore('Och dimensioneringen?','SE')",sandbox);
  await vm.runInContext("sendCore('Okej, vi återgår till materialvalet.','SE')",sandbox);
  const sent=requests[2].conversation;
  assert.equal(sent[0].content,'Rättelse: 25 m².');
  assert.ok(sent.some(t=>t.role==='assistant' && t.source==='FAQ' && t.content.length>1000));
  assert.ok(sent.some(t=>t.role==='assistant' && t.source==='CONTACT' && /personligen/.test(t.content)));
  assert.equal(sent.at(-1).source,'CONTACT');
  assert.equal(shown.length,6);
});
