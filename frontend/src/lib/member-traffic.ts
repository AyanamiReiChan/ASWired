export const memberTrafficRanges = [
 {value:'cycle',label:'本期'},
 {value:'24h',label:'最近 24 小时'},
 {value:'7d',label:'最近 7 天'},
 {value:'30d',label:'最近 30 天'},
] as const;
export type MemberTrafficRange = typeof memberTrafficRanges[number]['value'];
export type TrafficAmounts = {
 totalBytes:number; uploadBytes:number; downloadBytes:number;
 rawTotalBytes:number; rawUploadBytes:number; rawDownloadBytes:number; gap:boolean;
};
export type MemberTrafficNode = TrafficAmounts & {
 id:string; kind:'inbound'|'historical'; nodeId:string; inboundId:string;
 nodeName:string; serverId:string; serverName:string; share:number;
};
export type MemberTraffic = {
 memberId:string; range:MemberTrafficRange; generatedAt:string;
 from:string|null; to:string; endExclusive:true;
 scope:'current-subscription-cycles'|'owner-history';
 windows:{subscriptionId:string;subscriptionName:string;from:string;to:string}[];
 totals:TrafficAmounts; rows:MemberTrafficNode[]; hasUnmappedTraffic:boolean;
};
export type MemberTrafficState = {loading:boolean;data:MemberTraffic|null;error:string};

const invalid = () => new Error('主控返回的流量统计不完整，请刷新重试');
function object(value:unknown):Record<string,unknown> {
 if (!value || typeof value!=='object' || Array.isArray(value)) throw invalid();
 return value as Record<string,unknown>;
}
function text(value:unknown):string {return typeof value==='string'?value:'';}
function date(value:unknown):string {
 if(typeof value!=='string'||!Number.isFinite(Date.parse(value)))throw invalid();
 return value;
}
function amounts(value:unknown):TrafficAmounts {
 const row=object(value),result={} as TrafficAmounts;
 for(const key of ['totalBytes','uploadBytes','downloadBytes','rawTotalBytes','rawUploadBytes','rawDownloadBytes'] as const){
  const amount=row[key];
  if(typeof amount!=='number'||!Number.isFinite(amount)||amount<0)throw invalid();
  result[key]=amount;
 }
 if(typeof row.gap!=='boolean')throw invalid();
 result.gap=row.gap;
 return result;
}

// Keep zero distinct from an unavailable response, and never substitute a pool's usage.
export function memberTrafficView(value:unknown,memberId:string,range:MemberTrafficRange):MemberTraffic {
 const data=object(value);
 if(data.memberId!==memberId||data.range!==range||data.endExclusive!==true)throw invalid();
 const scope=range==='cycle'?'current-subscription-cycles':'owner-history';
 if(data.scope!==scope||!Array.isArray(data.rows)||!Array.isArray(data.windows)||typeof data.hasUnmappedTraffic!=='boolean')throw invalid();
 const totals=amounts(data.totals),ids=new Set<string>();
 const rows=data.rows.map(value=>{
  const row=object(value),usage=amounts(row),id=text(row.id);
  if(!id||ids.has(id)||!['inbound','historical'].includes(text(row.kind)))throw invalid();
  ids.add(id);
  return {...usage,id,kind:row.kind as MemberTrafficNode['kind'],nodeId:text(row.nodeId),inboundId:text(row.inboundId),
   nodeName:text(row.nodeName)||'未知节点',serverId:text(row.serverId),serverName:text(row.serverName),
   share:totals.totalBytes>0?Math.max(0,Math.min(100,usage.totalBytes/totals.totalBytes*100)):0};
 }).sort((a,b)=>b.totalBytes-a.totalBytes||a.nodeName.localeCompare(b.nodeName,'zh-CN'));
 const windows=data.windows.map(value=>{
  const window=object(value);
  return {subscriptionId:text(window.subscriptionId),subscriptionName:text(window.subscriptionName),from:date(window.from),to:date(window.to)};
 });
 return {memberId,range,generatedAt:date(data.generatedAt),from:data.from===null?null:date(data.from),to:date(data.to),
  endExclusive:true,scope,windows,totals,rows,hasUnmappedTraffic:data.hasUnmappedTraffic};
}

export function createMemberTrafficLoader(
 request:(path:string,init:RequestInit)=>Promise<unknown>,
 publish:(state:MemberTrafficState)=>void,
){
 let generation=0,controller:AbortController|null=null;
 const cancel=()=>{generation++;controller?.abort();controller=null;};
 return {
  cancel,
  async load(memberId:string,range:MemberTrafficRange){
   cancel();
   const current= generation, pending=new AbortController();controller=pending;
   publish({loading:true,data:null,error:''});
   try{
    const response=await request(`/api/members/${encodeURIComponent(memberId)}/traffic?range=${range}`,{signal:pending.signal});
    if(current!==generation||pending.signal.aborted)return;
    const data=memberTrafficView(response,memberId,range);
    publish({loading:false,data,error:''});
   }catch(cause){
    if(current!==generation||pending.signal.aborted)return;
    publish({loading:false,data:null,error:cause instanceof Error?cause.message:'流量统计读取失败，请重试'});
   }finally{if(current===generation)controller=null;}
  },
 };
}
