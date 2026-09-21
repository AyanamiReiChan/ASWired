import type { Row } from './data';

export function belongsToServer(row: Row, server: Row): boolean {
  return row.serverId ? row.serverId === server.id : row.server === server.name;
}

export function inboundManagerURL(row: Row): string {
  const query = new URLSearchParams({ xray: String(row.serverId ?? ''), tab: 'inbounds' });
  if (row.inboundId || row.id) query.set('inbound', String(row.inboundId || row.id));
  return `/servers?${query}`;
}

// A structural preview only. Subscription credentials are compiled by the controller.
export function inboundPreview(row: Row): Record<string, unknown> {
  if (row.security && row.security !== 'reality') {
    const protocol = String(row.protocol ?? '').toLowerCase();
    const stream:Record<string,unknown> = {network:row.network,security:row.security};
    if(row.security==='tls')stream.tlsSettings={certificates:[{certificateFile:row.certificateFile,keyFile:row.keyFile}],...(row.alpn?{alpn:String(row.alpn).split(',').map(s=>s.trim())}:{})};
    if(row.network==='ws')stream.wsSettings={path:row.path||'/'};
    if(row.network==='grpc')stream.grpcSettings={serviceName:row.serviceName||''};
    if(row.network==='hysteria')stream.hysteriaSettings={version:2};
    if(['anytls','snell'].includes(protocol))return {type:protocol,name:row.tag,listen:row.listen||'0.0.0.0',port:row.port,users:[],...(protocol==='snell'?{version:row.snellVersion}:{certificate:row.certificateFile,private_key:row.keyFile}),udp:false};
    const settings:Record<string,unknown> = protocol==='socks5'||protocol==='http'?{accounts:[],...(protocol==='socks5'?{auth:'password',udp:false}:{})}:{clients:[]};
    if(protocol==='vless')settings.decryption='none';
    if(protocol==='shadowsocks'){settings.method=row.method;settings.network='tcp,udp';}
    if(protocol==='hysteria2')settings.version=2;
    return {tag:row.tag,listen:row.listen||'0.0.0.0',port:row.port,protocol:protocol==='hysteria2'?'hysteria':protocol==='socks5'?'socks':protocol,settings,streamSettings:stream};
  }
  const names = String(row.sni ?? '').split(/[\s,，]+/).filter(Boolean);
  const ids = String(row.shortIds ?? '').split(/[,，\n]/).map(id => id.trim()).filter(Boolean);
  const reality: Record<string, unknown> = {
    target: row.target ?? '', serverNames: names, privateKey: row.privateKey ? '••••••••（已隐藏）' : '',
    shortIds: [...new Set([...ids, ...(row.allowEmptyShortId ? [''] : [])])],
    xver: Number(row.xver ?? 0), show: Boolean(row.realityShow),
  };
  for (const key of ['minClientVer', 'maxClientVer', 'maxTimeDiff']) {
    if (row[key] != null && row[key] !== '') reality[key] = row[key];
  }
  return {
    tag: row.tag, listen: row.listen || '0.0.0.0', port: row.port, protocol: 'vless',
    settings: { decryption: 'none', clients: [] },
    streamSettings: { network: 'tcp', security: 'reality', realitySettings: reality, ...(row.streamSettings?.sockopt ? {sockopt:row.streamSettings.sockopt} : {}) },
    ...(row.sniffing === '关闭' ? {} : {sniffing:{enabled:true,destOverride:['http','tls','quic'],routeOnly:row.sniffing === '仅路由'}}),
  };
}
