import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';
const source=await fs.readFile(new URL('../public/chat-ui.js',import.meta.url),'utf8');
const waiting=source.slice(source.indexOf('let loaderTimer;'),source.indexOf('function updateEnterHelp'));
test('waiting status appears immediately, updates only after actual delay and cancels on completion',()=>{
 for(const lang of ['SE','DA','DE','EN']){
  const status={textContent:''},timers=new Map();let hidden=true,next=0;
  const loader={classList:{add:()=>hidden=true,remove:()=>hidden=false}};
  const ctx=vm.createContext({lang,loader,document:{getElementById:()=>status},setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next;},clearTimeout:id=>timers.delete(id)});
  vm.runInContext(waiting+'showLoader()',ctx);assert.equal(hidden,false);assert.ok(status.textContent.length>5);
  const first=status.textContent;const timer=[...timers.values()][0];assert.equal(timer.ms,7000);timer.fn();assert.notEqual(status.textContent,first);
  vm.runInContext('hideLoader()',ctx);assert.equal(hidden,true);assert.equal(timers.size,0);
 }
 assert.match(source,/let muted = true/);
});
