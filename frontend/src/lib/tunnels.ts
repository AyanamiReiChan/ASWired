import type {Row} from './data';

export type TunnelHop={serverId:string;listen:string};
export type TunnelRule={protocol:string;listen:string;target:string};
export function addressPort(address:string){return String(address??'').match(/:(\d+)$/)?.[1]??'';}
export function joinAddress(host:string,port:string){return `${host.includes(':')&&!host.startsWith('[')?`[${host}]`:host}:${port}`;}
export function tunnelLegs(row:Row,servers:Row[]):{serverId:string;listen:string;target:string;protocol:string}[]{
 if(row.hops?.length)return row.hops.map((hop:TunnelHop,index:number)=>{
  const next=row.hops[index+1],server=servers.find(s=>s.id===next?.serverId);
  return {...hop,protocol:row.protocol??'tcp',target:next?joinAddress(String(server?.publicAddress||server?.address||''),addressPort(next.listen)):row.target};
 });
 return (row.rules??[]).map((rule:TunnelRule)=>({...rule,serverId:row.serverId}));
}
export function validateTunnel(name:string,hops:TunnelHop[],target:string,chain:boolean){
 if(!name.trim())throw new Error('请填写隧道名称');
 if(hops.length<(chain?2:1)||hops.length>8)throw new Error('链式转发需要 2–8 个跳点');
 if(hops.some(h=>!h.serverId))throw new Error('请选择每一跳的服务器');
 if(new Set(hops.map(h=>h.serverId)).size!==hops.length)throw new Error('转发链不能重复使用同一服务器');
 for(const address of [...hops.map(h=>h.listen),target]){
  const match=address.match(/^(?:\[[0-9a-fA-F:]+\]|[^\s:/\\?#@]+):(\d+)$/);
  if(!match||Number(match[1])<1||Number(match[1])>65535)throw new Error('地址须为主机:端口，端口范围为 1–65535；IPv6 请使用方括号');
 }
 if(hops.some(h=>!(/^(?:\d{1,3}\.){3}\d{1,3}:/.test(h.listen)||h.listen.startsWith('['))))throw new Error('监听地址须填写 IPv4 或 IPv6 地址');
}
