import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('../public/chat-brand.js',import.meta.url),'utf8');
function app({language='SE',embedded=false}={}) {
 const nodes=new Map(), observers=[], windowEvents={}, commands=[];
 const make=id=>{ const el={id,textContent:'',style:{},dataset:{},events:{},attributes:{},children:[],hidden:false,value:'',
  addEventListener(name,fn){this.events[name]=fn;},setAttribute(k,v){this.attributes[k]=v;},focus(){this.focused=true;},click(){this.events.click?.();},
  querySelector(){return this.label ||= {textContent:''};},showModal(){this.open=true;},close(){this.open=false;this.events.close?.();}}; nodes.set(id,el);return el; };
 for(const id of ['ai-label','skip-input','chat-region','loader','langSelect','contact-dialog','messages','welcome','brand-title','brand-subtitle','language-label','welcome-title','welcome-description','personal-help','contact-title','message-label','send-btn','new-chat-btn','close-chat-btn','expand-chat-btn','close-contact','user-input'])make(id);
 nodes.get('langSelect').value=language;
 const quick=['tiles','installation','project'].map(k=>{const n=make('quick-'+k);n.dataset.quick=k;return n;});
 const contact=[make('contact-a'),make('contact-b')];let sent;
 nodes.get('send-btn').events.click=()=>{sent=nodes.get('user-input').value;};
 const document={documentElement:{},getElementById:id=>nodes.get(id),querySelectorAll:q=>q==='[data-quick]'?quick:contact};
 const window={addEventListener(k,fn){windowEvents[k]=fn;}};
 window.parent=embedded?{postMessage(data,target){commands.push({data,target});}}:window;
 class Observer{constructor(fn){observers.push(fn);}observe(){}}
 vm.runInNewContext(source,{document,window,MutationObserver:Observer});
 return {nodes,quick,contact,document,commands,windowEvents,observers,get sent(){return sent;}};
}
test('welcome shortcuts submit real questions in all four languages without inventing replies',()=>{
 const expected={SE:/uteklinker/,DA:/udendørsfliser/,DE:/Außenfliesen/,EN:/outdoor tiles/};
 for(const language of Object.keys(expected)){
  const p=app({language});p.quick[0].click();assert.match(p.sent,expected[language]);
  assert.equal(p.nodes.get('messages').children.length,0,'the brand layer must not supply demo answers');
  assert.match(p.nodes.get('brand-title').textContent,/Klinkerdäck/);
  p.nodes.get('messages').children.push({});p.observers[0]();assert.equal(p.nodes.get('welcome').hidden,true);
  p.nodes.get('messages').children=[];p.observers[0]();assert.equal(p.nodes.get('welcome').hidden,false);
 }
});
test('language updates and contact dialog work without exposing invented staff availability',()=>{
 const p=app();p.nodes.get('langSelect').value='DE';p.windowEvents['pronto-language-change']();
 assert.equal(p.document.documentElement.lang,'de');assert.equal(p.nodes.get('send-btn').attributes['aria-label'],'Nachricht senden');
 p.contact[0].click();assert.equal(p.nodes.get('contact-dialog').open,true);
 p.nodes.get('close-contact').click();assert.equal(p.nodes.get('contact-dialog').open,false);assert.equal(p.contact[0].focused,true);
 assert.doesNotMatch(p.nodes.get('personal-help').textContent,/verfügbar|online|geöffnet/i);
});
test('frame controls emit only language, close and resize commands, with no conversation payload',()=>{
 const p=app({embedded:true});p.nodes.get('close-chat-btn').click();p.nodes.get('expand-chat-btn').click();
 assert.deepEqual(p.commands.map(c=>JSON.stringify(c.data)),['{"type":"pronto-chat:language","language":"SE"}','{"type":"pronto-chat:close"}','{"type":"pronto-chat:toggle-size"}']);
 const standalone=app();assert.equal(standalone.nodes.get('close-chat-btn').events.click,undefined);
});
