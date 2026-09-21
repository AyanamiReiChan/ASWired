import {probeSamples,type ProbeSample} from './probe-history';

type Selection={server:string;identity:string;metric:string;range:string;network:boolean};
type History={series:ProbeSample[];method:string;bucketSeconds:number;loading:boolean;loaded:boolean;error:string};
type Payload={series?:Record<string,ProbeSample[]>;method?:string;bucket_sec?:number};

export class ProbeHistoryError extends Error {
 constructor(message:string,public status:number){super(message);}
}

export function createProbeHistory(read:(path:string,signal:AbortSignal)=>Promise<Payload>,onAccessRevoked?:(cause:ProbeHistoryError)=>void){
 const empty=():History=>({series:[],method:'',bucketSeconds:300,loading:false,loaded:false,error:''});
 let state=$state<History>(empty());
 let key='',generation=0,controller:AbortController|undefined;

 function clear(){generation++;controller?.abort();controller=undefined;key='';state=empty();}

 async function load(selection:Selection){
  const request=++generation;
  controller?.abort();const active=new AbortController();controller=active;
  const nextKey=JSON.stringify(selection);
  if(key!==nextKey){key=nextKey;state=empty();}
  state.loading=true;
  const timeout=setTimeout(()=>active.abort(),15000);
  try{
   const body=await read(`/api/public/probe-series?server=${encodeURIComponent(selection.server)}&metric=${selection.network?'network':'system'}&target=0&range=${encodeURIComponent(selection.range)}`,active.signal);
   if(request!==generation)return;
   if(!body.series||typeof body.series!=='object'||Array.isArray(body.series))throw new Error('历史数据格式异常，请稍后重试');
   const series=probeSamples(body.series,selection.metric);
   state={series,method:body.method??'',bucketSeconds:Number.isFinite(body.bucket_sec)&&body.bucket_sec!>0?body.bucket_sec!:300,loading:false,loaded:true,error:''};
  }catch(cause){
   if(request!==generation)return;
   if(cause instanceof ProbeHistoryError&&[401,403,404].includes(cause.status)){state=empty();state.error=cause.message;onAccessRevoked?.(cause);return;}
   state.error=active.signal.aborted?'历史读取超时，请稍后重试':cause instanceof Error?cause.message:'历史读取失败';
  }finally{
   clearTimeout(timeout);
   if(request===generation){state.loading=false;controller=undefined;}
  }
 }
 return {get state(){return state;},load,clear};
}
