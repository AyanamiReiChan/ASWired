import {api} from './store.svelte';
export type LogFile={name:string;size:number;modifiedAt:string;active:boolean};
export type Inventory={directory:string;files:LogFile[];totalSize:number;maxSize:number;maxArchives:number};
export type FileLine={file:string;offset:number;text:string};
export type LogSnapshot={lines:FileLine[];truncated:boolean;inventory:Inventory};
export type LogScope={stream:string;serverId?:string};
export async function readLogFiles(scope:LogScope,limit=100,signal?:AbortSignal):Promise<LogSnapshot>{
 if(scope.serverId)return api(`/api/servers/${encodeURIComponent(scope.serverId)}/logs`,{method:'POST',body:JSON.stringify({operation:'read',stream:scope.stream,limit}),signal});
 const suffix=`?stream=${encodeURIComponent(scope.stream)}`;
 const [tail,inventory]=await Promise.all([api<{lines:FileLine[];truncated:boolean}>(`/api/logs/entries${suffix}&limit=${limit}`,{signal}),api<Inventory>(`/api/logs/files${suffix}`,{signal})]);
 return {...tail,inventory};
}
export async function removeLogFile(scope:LogScope,name?:string,limit=100):Promise<LogSnapshot|undefined>{
 const body=JSON.stringify({operation:'remove',stream:scope.stream,name:name??'',all:!name,confirm:true,limit});
 const result=await api(scope.serverId?`/api/servers/${encodeURIComponent(scope.serverId)}/logs`:`/api/logs/files/remove?stream=${encodeURIComponent(scope.stream)}`,{method:'POST',body});
 return scope.serverId?result:undefined;
}
export function parseFileLine(line:FileLine):Record<string,any>{try{return {...JSON.parse(line.text),key:`${line.file}:${line.offset}`};}catch{return {key:`${line.file}:${line.offset}`,msg:line.text};}}
export function formatFileLine(line:FileLine){const row=parseFileLine(line);if(!row.time)return line.text;const at=new Date(row.time).toLocaleString('zh-CN',{hour12:false});const extras=Object.entries(row).filter(([k,v])=>!['time','key','level','msg','message'].includes(k)&&v!==''&&v!=null).map(([k,v])=>`${k}=${typeof v==='object'?JSON.stringify(v):v}`).join(' ');return `${at} [${row.level??'INFO'}] ${row.msg??row.message??row.event??''}${extras?' '+extras:''}`;}
