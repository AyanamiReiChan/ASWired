export type RoutingRule = Record<string, any>;
export const arrayFields = ['domain', 'ip', 'protocol', 'source', 'user', 'inboundTag'];
export const stringFields = ['port', 'sourcePort', 'network', 'attrs'];
export const routingFields = [
  ['domain','域名','geosite:openai, domain:example.com'], ['ip','目标 IP','geoip:cn, 10.0.0.0/8'],
  ['protocol','协议','bittorrent, http, tls'], ['port','目标端口','80,443,1000-2000'],
  ['sourcePort','来源端口','1234'], ['network','网络','tcp,udp'], ['source','来源 IP','10.0.0.1'],
  ['user','用户','user@example.com'], ['inboundTag','入站标签','留空作用于全部入站'],
  ['attrs','属性表达式',"attrs[':method'] == 'GET'"]
];
export const quickRules = [
  {name:'禁止 BT', rule:{protocol:['bittorrent'],outboundTag:'block'}},
  {name:'禁止大陆 IP', rule:{ip:['geoip:cn'],outboundTag:'block'}},
  {name:'OpenAI 直连', rule:{domain:['geosite:openai'],outboundTag:'direct'}},
  {name:'禁止内网访问', rule:{ip:['geoip:private'],outboundTag:'block'}},
  {name:'RFC EMBY', rule:{domain:['rfc.uhdnow.com']}},
  {name:'TikTok', rule:{domain:['geosite:tiktok']}},
  {name:'防止送中', rule:{domain:['geosite:google','geosite:meta'],outboundTag:'warp-v4'}}
];
export function parseRoutingJSON(value:string):Record<string,any> {
  const config=JSON.parse(value);
  if(!config||typeof config!=='object'||Array.isArray(config))throw new Error('路由 JSON 必须是对象');
  for(const key of ['rules','balancers']) {
    if(config[key]==null)continue;
    if(!Array.isArray(config[key])||config[key].some((item:any)=>!item||typeof item!=='object'||Array.isArray(item)))throw new Error(`${key} 必须是对象数组`);
  }
  for(const rule of config.rules??[]) for(const key of arrayFields) {
    if(rule[key]!=null&&(!Array.isArray(rule[key])||rule[key].some((item:any)=>typeof item!=='string')))throw new Error(`${key} 必须是字符串数组`);
  }
  for(const balance of config.balancers??[]) {
    if(balance.selector!=null&&(!Array.isArray(balance.selector)||balance.selector.some((item:any)=>typeof item!=='string')))throw new Error('selector 必须是字符串数组');
    if(balance.strategy!=null&&(typeof balance.strategy!=='object'||Array.isArray(balance.strategy)))throw new Error('strategy 必须是对象');
  }
  return config;
}
export function csvValues(value:string):string[] { return value.split(',').map(s=>s.trim()).filter(Boolean); }
export function setRuleField(rule:RoutingRule,key:string,value:string):RoutingRule {
  const next={...rule};
  if(!value.trim()) delete next[key];
  else next[key]=arrayFields.includes(key)?csvValues(value):value.trim();
  return next;
}
export function ruleApplies(rule:RoutingRule,scope:string):boolean {
  return !scope || !rule.inboundTag?.length || rule.inboundTag.includes(scope);
}
export function isCatchAll(rule:RoutingRule):boolean {
  return !!rule.inboundTag?.length && Object.entries(rule).every(([key,value])=>
    ['type','inboundTag','outboundTag','balancerTag','ruleTag'].includes(key) || value==null || value==='' || (Array.isArray(value)&&!value.length));
}
export function ruleSummary(rule:RoutingRule):string {
  const conditions=Object.entries(rule).filter(([key,value])=>!['type','inboundTag','outboundTag','balancerTag','ruleTag'].includes(key)&&value!=null&&value!=='');
  return conditions.map(([key,value])=>`${key}: ${Array.isArray(value)?value.join(', '):typeof value==='object'?JSON.stringify(value):value}`).join(' · ') || '全部流量';
}
export function moveRule(rules:RoutingRule[],from:number,to:number):RoutingRule[] {
  if(from<0||to<0||from>=rules.length||to>=rules.length||rules[from].outboundTag==='api'||rules[to].outboundTag==='api')return rules;
  const next=[...rules];const [item]=next.splice(from,1);next.splice(to,0,item);return next;
}
export function routingURL(collection:string,row:Record<string,any>):string {
  const server=collection==='servers'?row.id:row.serverId;
  if(collection==='nodes'&&!row.managedInbound)return '';
  const tag=collection==='inbounds'||collection==='nodes'?row.tag:undefined;
  return server?`/servers?xray=${encodeURIComponent(server)}&tab=routing${tag?`&routingScope=${encodeURIComponent(tag)}`:''}`:'';
}
