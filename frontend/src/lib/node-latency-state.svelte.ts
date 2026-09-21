export type NodeLatencyResult = {status:'queued'|'running'|'success'|'failed'|'cancelled';latency?:number;error?:string};
type TestState = {running:boolean;stopping:boolean;total:number;completed:number;succeeded:number;failed:number;results:Record<string,NodeLatencyResult>};
type Options = {read:(id:string,signal:AbortSignal)=>Promise<{latency:number}>;identity:()=>string;canTest:(id:string)=>boolean;timeoutMs?:number};

export function createNodeLatencyTests(options:Options){
 const empty=():TestState=>({running:false,stopping:false,total:0,completed:0,succeeded:0,failed:0,results:{}});
 let state=$state<TestState>(empty());
 let generation=0,controller:AbortController|undefined,syncedIdentity:string|undefined;
 function clear(){generation++;controller?.abort();controller=undefined;state=empty();}
 function syncIdentity(){const identity=options.identity();if(identity!==syncedIdentity){syncedIdentity=identity;clear();}}
 function stop(){if(state.running){state.stopping=true;controller?.abort();}}
 async function run(ids:string[]){
  syncIdentity();
  if(state.running)return;
  const owner=options.identity();
  const targets=[...new Set(ids)].filter(id=>id&&options.canTest(id));
  if(!owner||!targets.length)return;
  const current=++generation;
  state={...empty(),running:true,total:targets.length,results:{...state.results,...Object.fromEntries(targets.map(id=>[id,{status:'queued' as const}]))}};
  for(const id of targets){
   if(current!==generation)return;
   if(options.identity()!==owner){clear();return;}
   if(state.stopping)break;
   if(!options.canTest(id)){state.results[id]={status:'cancelled'};continue;}
   const active=new AbortController();controller=active;
   state.results[id]={status:'running'};
   let timedOut=false;
   const timer=setTimeout(()=>{timedOut=true;active.abort();},options.timeoutMs??15000);
   try{
    const result=await options.read(id,active.signal);
    if(current!==generation)return;
    if(options.identity()!==owner){clear();return;}
    if(state.stopping){state.results[id]={status:'cancelled'};break;}
    if(timedOut)throw new Error('测速超时，请重试');
    if(typeof result.latency!=='number'||!Number.isFinite(result.latency)||result.latency<0)throw new Error('主控未返回有效延迟');
    state.results[id]={status:'success',latency:result.latency};state.succeeded++;
   }catch(cause){
    if(current!==generation)return;
    if(options.identity()!==owner){clear();return;}
    if(state.stopping){state.results[id]={status:'cancelled'};break;}
    state.results[id]={status:'failed',error:timedOut?'测速超时，请重试':cause instanceof Error?cause.message:'测速失败，请重试'};state.failed++;
    if([401,403].includes(Number((cause as {status?:number})?.status)))state.stopping=true;
   }finally{clearTimeout(timer);if(current===generation)controller=undefined;}
   state.completed++;
  }
  if(current!==generation)return;
  for(const id of targets)if(['queued','running'].includes(state.results[id].status))state.results[id]={status:'cancelled'};
  state.running=false;
  return {completed:state.completed,total:state.total,succeeded:state.succeeded,failed:state.failed};
 }
 return {get state(){return state;},run,stop,clear,syncIdentity};
}
