export type FirewallRule = {id:string;name:string;protocol:'tcp'|'udp';port:number;allowedCidrs:string[]};
export type FirewallTarget = {id?:string;name:string;protocol:'tcp'|'udp';port:number};
export type FirewallTask = {id:string;status:string;error?:string};
export type FirewallObservation = {supported:boolean;backend?:string;revision:number;rules:FirewallRule[];applied:boolean;checkedAt?:string;lastError?:string};
export type FirewallSnapshot = {serverId:string;revision:number;rules:FirewallRule[];targets:FirewallTarget[];capable:boolean;task:FirewallTask|null;observed:FirewallObservation|null};
export type FirewallDraft = Omit<FirewallRule,'allowedCidrs'> & {addresses:string};

export const firewallTargetKey=(target:Pick<FirewallTarget,'protocol'|'port'>)=>`${target.protocol}:${target.port}`;
export const firewallTaskPending=(task:FirewallTask|null|undefined)=>!!task&&['queued','running','待下发','执行中'].includes(task.status);
export const firewallTaskUnknown=(task:FirewallTask|null|undefined)=>!!task&&['unknown','结果未明'].includes(task.status);
export const firewallTaskLabel=(task:FirewallTask|null|undefined)=>task?({queued:'待下发',running:'执行中',success:'成功',failed:'失败',unsupported:'不支持',unknown:'结果未明',superseded:'已撤回'} as Record<string,string>)[task.status]??task.status:'无任务';

function ipFamily(address:string):4|6|null {
 if(address.includes(':')){
  if(!/^[0-9a-fA-F:.]+$/.test(address))return null;
  try{const url=new URL(`http://[${address}]/`);return url.hostname.startsWith('[')?6:null;}catch{return null;}
 }
 const parts=address.split('.');
 return parts.length===4&&parts.every(part=>/^(0|[1-9]\d{0,2})$/.test(part)&&Number(part)<=255)?4:null;
}
function addressBits(address:string,family:4|6):bigint {
 if(family===4)return address.split('.').reduce((value,octet)=>(value<<8n)+BigInt(octet),0n);
 const sides=address.split('::'),left=sides[0]?sides[0].split(':'):[],right=sides[1]?sides[1].split(':'):[];
 const groups=sides.length===2?[...left,...Array(8-left.length-right.length).fill('0'),...right]:left;
 return groups.reduce((value,group)=>(value<<16n)+BigInt('0x'+group),0n);
}
function globalUnicast(value:bigint,family:4|6):boolean {
 if(family===4)return value!==0n&&value!==0xffffffffn&&(value>>24n)!==127n&&(value>>28n)!==14n&&(value>>16n)!==0xa9fen;
 return value!==0n&&value!==1n&&(value>>120n)!==255n&&(value>>118n)!==0x3fan;
}
export function parseFirewallAddresses(value:string):string[] {
 const entries=value.split(/[\s,，]+/u).map(item=>item.trim()).filter(Boolean);
 if(!entries.length)throw new Error('请至少填写一个允许连接的来源 IP 或 CIDR；解除限制请移除此规则');
 if(entries.length>128)throw new Error('每条规则最多填写 128 个 IP 或 CIDR');
 const result:string[]=[],seen=new Set<string>();
 for(const entry of entries){
  const parts=entry.split('/'),family=ipFamily(parts[0]);
  if(!family||parts.length>2||(parts.length===2&&(!/^\d{1,3}$/.test(parts[1])||Number(parts[1])>(family===4?32:128))))throw new Error(`无效的 IP 或 CIDR：${entry}`);
  const address=family===6?new URL(`http://[${parts[0]}]/`).hostname.slice(1,-1):parts[0];
  const bits=parts.length===2?Number(parts[1]):family===4?32:128,number=addressBits(address,family),shift=BigInt((family===4?32:128)-bits),base=(number>>shift)<<shift;
  if(family===6&&(number>>32n)===0xffffn)throw new Error(`不支持 IPv4 映射 IPv6 地址：${entry}`);
  if(bits===0||!globalUnicast(number,family)||!globalUnicast(base,family))throw new Error(`请使用具体单播 IP 或网段，不能填写全网、回环、未指定、链路本地或组播地址：${entry}`);
  const normalized=address+(parts.length===2?`/${Number(parts[1])}`:'');
  if(!seen.has(normalized)){seen.add(normalized);result.push(normalized);}
 }
 return result;
}
export function firewallDrafts(rules:FirewallRule[]):FirewallDraft[]{return rules.map(rule=>({...rule,addresses:rule.allowedCidrs.join('\n')}));}
export function prepareFirewallRules(drafts:FirewallDraft[],targets:FirewallTarget[]):FirewallRule[]{
 if(drafts.length>64)throw new Error('每台服务器最多设置 64 条端口规则');
 const ids=new Set<string>(),ports=new Set<string>();
 return drafts.map(draft=>{
  if(!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(draft.id)||ids.has(draft.id))throw new Error('规则标识重复或无效，请重新载入配置');
  ids.add(draft.id);
  const name=draft.name.trim(),key=firewallTargetKey(draft);
  if(!name||[...name].length>100||/\p{Cc}/u.test(name))throw new Error('规则名称须为 1–100 个字符，且不能含控制字符');
  if(draft.protocol!=='tcp'||!Number.isInteger(draft.port)||draft.port<1||draft.port>65535||!targets.some(target=>firewallTargetKey(target)===key))throw new Error(`“${name}”的端口已不在可保护的入站中，请移除该规则或重新选择入站`);
  if(ports.has(key))throw new Error('同一个协议与端口只能设置一条规则，请把允许的地址合并到同一条规则');
  ports.add(key);
  return {id:draft.id,name,protocol:draft.protocol,port:draft.port,allowedCidrs:parseFirewallAddresses(draft.addresses)};
 });
}
export function firewallPolicyState(snapshot:FirewallSnapshot|null,verificationPending=false):{label:string;tone:'neutral'|'success'|'warning'|'danger'}{
 if(!snapshot)return {label:'尚未读取',tone:'neutral'};
 if(verificationPending)return {label:'等待核实执行结果',tone:'warning'};
 if(firewallTaskPending(snapshot.task))return {label:firewallTaskLabel(snapshot.task),tone:'warning'};
 if(firewallTaskUnknown(snapshot.task))return {label:'执行结果未明',tone:'warning'};
 if(snapshot.observed?.lastError)return {label:'实际状态异常',tone:'danger'};
 if(snapshot.observed?.supported===false)return {label:'节点环境不支持',tone:'warning'};
 if(snapshot.observed?.applied===true&&snapshot.observed.revision===snapshot.revision)return {label:snapshot.rules.length?'已应用':'端口限制已解除',tone:'success'};
 if(snapshot.task&&['failed','失败','unsupported','不支持'].includes(snapshot.task.status))return {label:'任务失败',tone:'danger'};
 if(!snapshot.capable)return {label:'需要升级 Agent',tone:'warning'};
 if(snapshot.revision===0&&!snapshot.rules.length)return {label:'未启用',tone:'neutral'};
 return {label:snapshot.observed?'策略尚未应用':'尚无节点执行回报',tone:'warning'};
}
export function checkedFirewallSnapshot(value:unknown,serverId:string):FirewallSnapshot{
 const item=value as FirewallSnapshot;
 const rulesValid=(rules:unknown)=>Array.isArray(rules)&&rules.every(rule=>rule&&typeof rule.id==='string'&&typeof rule.name==='string'&&['tcp','udp'].includes(rule.protocol)&&Number.isInteger(rule.port)&&rule.port>=1&&rule.port<=65535&&Array.isArray(rule.allowedCidrs)&&rule.allowedCidrs.every((cidr:unknown)=>typeof cidr==='string'));
 if(!item||item.serverId!==serverId||!Number.isSafeInteger(item.revision)||item.revision<0||!rulesValid(item.rules)||!Array.isArray(item.targets)||item.targets.some(target=>!target||typeof target.name!=='string'||!['tcp','udp'].includes(target.protocol)||!Number.isInteger(target.port)||target.port<1||target.port>65535)||typeof item.capable!=='boolean'||(item.task!=null&&(typeof item.task.id!=='string'||!item.task.id||typeof item.task.status!=='string'))||(item.observed!=null&&(typeof item.observed.supported!=='boolean'||typeof item.observed.applied!=='boolean'||!Number.isSafeInteger(item.observed.revision)||!rulesValid(item.observed.rules))))throw new Error('主控返回的端口访问控制状态无效，请重新载入');
 return item;
}
