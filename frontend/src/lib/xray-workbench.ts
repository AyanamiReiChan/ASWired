export type XrayObject = Record<string, any>;
export const outboundTypes = [
 ['node','从节点创建出站'],['freedom','Freedom · 直连出站'],['blackhole','Blackhole · 阻止出站'],
 ['dns','DNS · DNS 接管'],['http','HTTP · HTTP 代理出站'],['loopback','Loopback · 回环到入站'],
 ['warp','Cloudflare WARP'],['wireguard','WireGuard 中转'],
] as const;
export function objectJSON(text:string):XrayObject {
 const value=JSON.parse(text);if(!value||Array.isArray(value)||typeof value!=='object')throw new Error('请输入 JSON 对象');return value;
}
export function outboundTemplate(type:string,tag:string):XrayObject {
 const protocol=type==='warp'?'wireguard':type;
 const settings:Record<string,any>={freedom:{},blackhole:{response:{type:'none'}},dns:{network:'udp',address:'1.1.1.1',port:53},http:{servers:[{address:'',port:8080}]},loopback:{inboundTag:''},wireguard:{secretKey:'',address:[],peers:[{publicKey:'',endpoint:'',allowedIPs:['0.0.0.0/0','::/0'],keepAlive:25}],mtu:1280}};
 return {tag,protocol,settings:settings[protocol]??{}};
}
export function outboundFromNode(row:XrayObject,tag:string):XrayObject {
 let node={...row};
 if(row.uri){const uri=new URL(row.uri);if(uri.protocol!=='vless:')throw new Error('节点须为 VLESS TCP REALITY');const p=uri.searchParams;node={host:uri.hostname.replace(/^\[|\]$/g,''),port:Number(uri.port),uuid:decodeURIComponent(uri.username),network:p.get('type')||'tcp',security:p.get('security'),sni:p.get('sni'),publicKey:p.get('pbk'),shortId:p.get('sid')||'',flow:p.get('flow')||'',fingerprint:p.get('fp')||'chrome'};}
 if(!node.host||!node.uuid||!node.publicKey||!node.sni||node.security!=='reality'||!['tcp','raw',undefined,''].includes(node.network))throw new Error('节点缺少有效的 TCP REALITY 连接凭据，请选择有效套餐或补全节点配置');
 return {tag,protocol:'vless',settings:{vnext:[{address:node.host,port:Number(node.port),users:[{id:node.uuid,encryption:'none',...(node.flow&&node.flow!=='无'?{flow:node.flow}:{})}]}]},streamSettings:{network:'tcp',security:'reality',realitySettings:{serverName:node.sni,publicKey:node.publicKey,shortId:node.shortId??'',fingerprint:node.fingerprint||'chrome'}}};
}
export function outboundReferences(config:XrayObject,tag:string):string[] {
 const refs:string[]=[];
 for(const [i,rule] of (config.routing?.rules??[]).entries())if(rule.outboundTag===tag)refs.push(`规则 ${i+1}`);
 for(const b of config.routing?.balancers??[])if(b.fallbackTag===tag||b.selector?.some((prefix:string)=>tag.startsWith(prefix)))refs.push(`均衡器 ${b.tag}`);
 for(const out of config.outbounds??[])if(out.proxySettings?.tag===tag||out.streamSettings?.sockopt?.dialerProxy===tag)refs.push(`出站 ${out.tag}`);
 if(config.dns?.tag===tag)refs.push('DNS 标签');
 return refs;
}
export function replaceOutbound(config:XrayObject,index:number,next:XrayObject):XrayObject {
 if(!String(next.tag??'').trim()||!String(next.protocol??'').trim())throw new Error('出站标签与协议不能为空');
 const outbounds=[...(config.outbounds??[])];
 if(outbounds.some((out,i)=>i!==index&&out.tag===next.tag))throw new Error('出站标签已存在');
 const previous=outbounds[index];
 if(previous&&previous.tag!==next.tag&&outboundReferences(config,previous.tag).length)throw new Error('此标签被路由、均衡器或其他出站引用，请先调整引用再改名');
 if(index<0)outbounds.push(next);else outbounds[index]=next;
 return {...config,outbounds};
}
export function deleteOutbound(config:XrayObject,index:number):XrayObject {
 const outbounds=config.outbounds??[],out=outbounds[index];if(!out)throw new Error('出站已不存在');
 if(outbounds.length===1)throw new Error('至少保留一个出站');
 const refs=outboundReferences(config,out.tag);if(refs.length)throw new Error(`出站仍被引用：${refs.join('、')}`);
 return {...config,outbounds:outbounds.filter((_:any,i:number)=>i!==index)};
}
export function moveItem<T>(items:T[],from:number,to:number):T[] {
 if(from<0||to<0||from>=items.length||to>=items.length)return items;
 const next=[...items], [item]=next.splice(from,1);next.splice(to,0,item);return next;
}
export function graphError(config:XrayObject):string {
 const outs=config.outbounds??[],tags=new Set<string>();
 if(!Array.isArray(outs))return 'outbounds 须为数组';
 for(const out of outs){if(!out?.tag||tags.has(out.tag))return '出站标签不能为空或重复';tags.add(out.tag);}
 const routing=config.routing??{},balances=routing.balancers??[],rules=routing.rules??[];
 if(!Array.isArray(balances)||!Array.isArray(rules))return '路由规则与均衡器须为数组';
 const balTags=new Set<string>();
 for(const b of balances){if(!b?.tag||balTags.has(b.tag))return '均衡器标签不能为空或重复';balTags.add(b.tag);if(!Array.isArray(b.selector)||!b.selector.length||b.selector.some((p:any)=>typeof p!=='string'||!p)||!outs.some((o:any)=>o.protocol!=='blackhole'&&b.selector.some((p:string)=>o.tag.startsWith(p))))return `均衡器 ${b.tag} 未匹配有效出站`;if(b.fallbackTag&&!tags.has(b.fallbackTag))return `均衡器 ${b.tag} 的备用出站不存在`;}
 for(const [i,r] of rules.entries()){if(!r||typeof r!=='object'||Array.isArray(r))return `规则 ${i+1} 格式无效`;if(Boolean(r.outboundTag)===Boolean(r.balancerTag))return `规则 ${i+1} 必须选择一个出站或均衡器`;if(r.outboundTag&&!tags.has(r.outboundTag)&&r.outboundTag!==config.api?.tag&&r.outboundTag!=='api')return `规则 ${i+1} 的出站不存在`;if(r.balancerTag&&!balTags.has(r.balancerTag))return `规则 ${i+1} 的均衡器不存在`;}
 return '';
}
export function withRoutingObservers(config:XrayObject):XrayObject {
 const balances=config.routing?.balancers??[];
 const selectors=[...new Set<string>(balances.filter((b:any)=>['leastPing','leastLoad'].includes(b.strategy?.type)||b.fallbackTag).flatMap((b:any)=>b.selector??[]))];
 if(!selectors.length)return config;
 const burst=!!config.burstObservatory||balances.some((b:any)=>b.strategy?.type==='leastLoad');
 const next={...config},key=burst?'burstObservatory':'observatory';
 const previous=next[key]??{};
 next[key]={...(burst?{pingConfig:{destination:'https://www.gstatic.com/generate_204',interval:'1m',timeout:'10s',sampling:2}}:{probeURL:'https://www.gstatic.com/generate_204',probeInterval:'1m',enableConcurrency:true}),...previous,subjectSelector:[...new Set([...(previous.subjectSelector??[]),...(burst?next.observatory?.subjectSelector??[]:[]),...selectors])]};
 if(burst)delete next.observatory;
 return next;
}
