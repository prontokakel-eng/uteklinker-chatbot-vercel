import fs from 'node:fs/promises';
import { parseWorkbook } from '../lib/drive-knowledge.js';
import { createChatPipeline } from '../lib/chatPipeline.js';
import { contactState } from '../lib/store-contact.js';
import handler from '../api/chat.js';
const data=await parseWorkbook(await fs.readFile(new URL('../../faq-golden.xlsx',import.meta.url)));
const pipeline=createChatPipeline({knowledge:async()=>({status:'ready',data}),ai:async()=>{throw Error('Synthetic offline AI failure');}});
const checks=[];
const samples={SE:'Behöver betongen förbehandlas?',DA:'Skal betonen forbehandles?',DE:'Muss der Beton vorbehandelt werden?',EN:'Does the concrete need to be pre-treated?'};
let n=1;
async function query(text,lang='SE',extra={}){return pipeline({body:{text,lang,...extra},headers:{'x-forwarded-for':'192.0.2.'+(n++)}});}
for(const [lang,text] of Object.entries(samples)){
 const result=await query(text,lang);checks.push({test:'real FAQ and gate '+lang,pass:result.via==='faq'&&result.lang===lang,via:result.via,reply:result.reply});
}
for(const text of ['Vad kostar Lava?','What is the price of Lava?','Wie sind Ihre Öffnungszeiten?','Hvad er jeres åbningstider?']){
 const result=await query(text);checks.push({test:'unknown store fact',question:text,pass:result.via==='CONTACT'||result.via==='FILTER',via:result.via});
}
for(const input of ['',null,42,{},'a'.repeat(2001)]){const r=await query(input);checks.push({test:'invalid input '+typeof input,pass:r.via==='FILTER'});}
const refined=await query(samples.SE,'SE',{refine:true});checks.push({test:'AI failure during refinement is explicit',pass:refined.via==='AI_ERROR',via:refined.via});
let status;await handler({method:'GET'},{setHeader(){},status(n){status=n;return this;},json(){}});checks.push({test:'GET /api/chat rejected',pass:status===405,status});
const contact=contactState({env:{}});checks.push({test:'unconfigured contact is unknown and has no invented links',pass:contact.openNow===null&&contact.links.length===0});
const report={at:new Date().toISOString(),source:'Downloaded FAQ workbook snapshot; genuine gate and parser; no real external AI call',passed:checks.filter(x=>x.pass).length,total:checks.length,checks};
console.log(JSON.stringify(report,null,2));
await fs.writeFile(new URL('../../../outputs/initial-functional-test.json',import.meta.url),JSON.stringify(report,null,2));
process.exitCode=report.passed===report.total?0:1;
