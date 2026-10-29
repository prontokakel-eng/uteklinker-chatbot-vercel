// Manual acceptance runner. Private cases/results remain outside the repository.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('..',import.meta.url));
const [suitePath,resultPath]=process.argv.slice(2);
const outside=p=>p && path.isAbsolute(p) && path.relative(root,p).startsWith('..'+path.sep);
if(!outside(suitePath)||!outside(resultPath))throw Error('Supply absolute private suite and output paths outside the repository');
const base=new URL(process.env.CHATBOT_TEST_URL || '');
if(base.protocol!=='https:' || base.pathname!=='/' || base.search || base.username || base.password)throw Error('Set CHATBOT_TEST_URL to the explicit Preview HTTPS origin');
const suite=JSON.parse(await fs.readFile(suitePath,'utf8'));
if(suite.lang!=='SE' || suite.scenarios.reduce((n,s)=>n+s.turns.length,0)!==36)throw Error('Expected exactly 36 Swedish turns');
const report={startedAt:new Date().toISOString(),suiteVersion:suite.version,lang:'SE',commit:process.env.TEST_COMMIT || null,base:base.origin,scenarios:[]};
let lastStart=0;
const save=()=>fs.writeFile(resultPath,JSON.stringify(report,null,2),{mode:0o600});
for(const scenario of suite.scenarios) {
  const record={id:scenario.id,title:scenario.title,turns:[]};report.scenarios.push(record);
  const conversation=[];let routingContext;
  for(const spec of scenario.turns) {
    const delay=6500-(Date.now()-lastStart);if(delay>0)await new Promise(r=>setTimeout(r,delay));
    lastStart=Date.now();
    let response,result;
    try {
      response=await fetch(new URL('/api/chat',base),{method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({text:spec.question,lang:'SE',conversation,...(routingContext?{routingContext}:{})}),signal:AbortSignal.timeout(50000)});
      result=await response.json();
    }catch{result={source:'REQUEST_ERROR',reply:'The request did not complete.'};}
    const checks={http:response?.status===200,source:spec.sources.includes(result.source),
      required:(spec.required || []).every(s=>result.reply?.toLocaleLowerCase().includes(s.toLocaleLowerCase())),
      forbidden:(spec.forbidden || []).every(s=>!result.reply?.toLocaleLowerCase().includes(s.toLocaleLowerCase())),
      citation:!spec.citation || result.citations?.some(c=>c.url?.startsWith('https://klinkerdack.se/')),
      faqNoModel:result.source!=='FAQ' || !(result.modelDiagnostics || []).some(t=>t.responseId || t.model),
    };
    const turn={question:spec.question,expectation:spec.expectation,http:response?.status || null,
      seconds:Number(((Date.now()-lastStart)/1000).toFixed(2)),...result,checks,pass:Object.values(checks).every(Boolean)};
    record.turns.push(turn);await save();
    console.log(JSON.stringify({scenario:scenario.id,turn:record.turns.length,source:result.source,pass:turn.pass,seconds:turn.seconds}));
    if(response?.ok && typeof result.reply==='string') {
      conversation.push({role:'user',content:spec.question},{role:'assistant',content:result.reply,source:result.source});routingContext=result.routingContext;
    }
  }
}
report.completedAt=new Date().toISOString();await save();
const turns=report.scenarios.flatMap(s=>s.turns),failed=turns.filter(t=>!t.pass).length;
console.log(JSON.stringify({turns:turns.length,passed:turns.length-failed,failed}));
if(failed)process.exitCode=1;
