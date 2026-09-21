import type {Row} from './data';
import {isManagedRealityInbound} from './inbound-profile';
import {normalizeRealityFields,realityValidationError} from './reality';
import {deriveRealityPublicKey} from './reality-keys';

export const managedProtocols = ['VLESS','VMess','Trojan','Shadowsocks','Hysteria2','SOCKS5','HTTP','AnyTLS','Snell'];
export function withManagedFields(row:Row):Row {
 const aliases:Record<string,string>={ss:'Shadowsocks',socks:'SOCKS5',hy2:'Hysteria2'};
 const protocol=aliases[String(row.protocol).toLowerCase()]??managedProtocols.find(p=>p.toLowerCase()===String(row.protocol).toLowerCase())??row.protocol;
 return {...row,protocol,network:row.network??'tcp',security:row.security??(isManagedRealityInbound(row)?'reality':'none')};
}
export function protocolDefaults(row:Row,protocol:string):Row {
 const auxiliary=protocol==='AnyTLS'||protocol==='Snell';
 const network=protocol==='Hysteria2'?'hysteria':'tcp';
 const security=['Trojan','Hysteria2','AnyTLS'].includes(protocol)?'tls':protocol==='VLESS'?'reality':'none';
 return {...row,protocol,network,security,transport:`${network.toUpperCase()} / ${security==='reality'?'Reality':security.toUpperCase()}`,flow:security==='reality'?'xtls-rprx-vision':'无',settings:{},streamSettings:{},method:'aes-128-gcm',snellVersion:4,alpn:protocol==='Hysteria2'?'h3':'',...(auxiliary?{bridgePort:undefined}:{})};
}
export function protocolUnavailable(protocol:string,server?:Row):string {
 if(protocol==='Hysteria2')return server?.capabilities?.managed_protocols_v2?'':'Agent 需升级 Hysteria2 计量和撤销支持';
 if(protocol==='AnyTLS'||protocol==='Snell') return server?.capabilities?.[protocol.toLowerCase()]&&server?.capabilities?.managed_protocols_v2?'':'Agent 需升级并启用 Mihomo';
 if(protocol==='SOCKS5'||protocol==='HTTP') return server?.capabilities?.managed_account_reload?'':'Agent 需升级账号同步支持';
 return '';
}
export function managedInboundError(row:Row):string {
 if(!managedProtocols.includes(String(row.protocol)))return '请选择支持的受管协议';
 if(isManagedRealityInbound(row))return realityValidationError(row);
 if(row.security==='tls'&&(!String(row.sni??'').trim()||!String(row.certificateFile??'').trim()||!String(row.keyFile??'').trim()))return '请填写 SNI、Agent 证书路径和私钥路径';
 return '';
}
export async function prepareManagedInbound(row:Row):Promise<Row> {
 if(isManagedRealityInbound(row))return normalizeRealityFields({...row,shortIds:Array.isArray(row.shortIds)?row.shortIds.filter(Boolean).join(', '):row.shortIds,publicKey:await deriveRealityPublicKey(String(row.privateKey).trim())});
 const value={...row};
 for(const key of ['privateKey','publicKey','shortIds','shortId','serverNames','target','allowEmptyShortId','xver','minClientVer','maxClientVer','maxTimeDiff','realityShow'])delete value[key];
 return value;
}
