import {AsyncLocalStorage} from 'node:async_hooks';
import {performance} from 'node:perf_hooks';
const context=new AsyncLocalStorage();
export function withLatency(run,{clock=()=>performance.now(),meta={}}={}) {
  const started=clock(),events=[],metadata={...meta};
  const trace={clock,started,events,metadata,snapshot:()=>({totalMs:Math.round(clock()-started),...metadata,
    events:events.map(e=>({...e}))})};
  return context.run(trace,()=>run(trace));
}
export async function timeStage(stage,run) {
  const trace=context.getStore();
  if(!trace)return run();
  const started=trace.clock();let ok=false;
  try {const result=await run();ok=true;return result;} finally {
    if(trace.events.length<100)trace.events.push({stage,startMs:Math.round(started-trace.started),durationMs:Math.round(trace.clock()-started),ok});
  }
}
export function latencyMeta(values) {
  const trace=context.getStore();if(!trace)return;
  // Never record questions, answers, source IDs or provider errors.
  for(const key of ['knowledgeCache','knowledgeAgeMs','knowledgeStorage','reviewMode','reviewStorage']) {
    if(typeof values[key]==='number' || typeof values[key]==='string' && /^[a-z_]{1,30}$/u.test(values[key]))trace.metadata[key]=values[key];
  }
}
export function serverTiming(perf) {
  const times=new Map();for(const e of perf.events)times.set(e.stage,(times.get(e.stage)||0)+e.durationMs);
  return [...times].filter(([name])=>/^[a-z_]+$/u.test(name)).map(([name,ms])=>`${name};dur=${ms}`).join(', ');
}
