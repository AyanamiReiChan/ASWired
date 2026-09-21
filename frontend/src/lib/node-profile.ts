import type { Row } from './data';

export const nodeProtocols = ['VMess', 'VLESS', 'Trojan', 'Shadowsocks', 'Hysteria', 'Hysteria2', 'SOCKS5', 'HTTP', 'AnyTLS', 'Snell', 'TUIC', 'WireGuard'];
const nodeSchemes = ['vmess:', 'vless:', 'trojan:', 'ss:', 'hysteria:', 'hysteria2:', 'hy2:', 'socks:', 'socks5:', 'http:', 'https:', 'anytls:', 'snell:', 'tuic:', 'wireguard:', 'wg:'];
export function nodeURIError(raw: string): string {
  try {
    const url = new URL(raw.trim());
    if (!nodeSchemes.includes(url.protocol)) return '不支持的节点链接协议';
    if (url.protocol === 'vmess:' || url.protocol === 'ss:') return raw.trim().split('://')[1] ? '' : '节点链接内容为空';
    const port = Number(url.port || ({'http:':80,'https:':443,'hy2:':443,'hysteria2:':443,'anytls:':443} as Record<string,number>)[url.protocol] || 0);
    if (!url.hostname || !Number.isInteger(port) || port < 1 || port > 65535) return '节点链接须包含地址和 1–65535 的端口';
    return '';
  } catch { return '请填写有效的节点链接'; }
}
export function isSupportedNode(row: Row): boolean {
  if (row.managementError) return false;
  if (String(row.uri ?? '').trim()) return nodeURIError(String(row.uri)) === '';
  return [...nodeProtocols.map(value => value.toLowerCase()), 'ss', 'hy2', 'socks', 'wg'].includes(String(row.protocol ?? row.type ?? '').toLowerCase());
}

const profileError = '仅支持 VLESS TCP REALITY 节点，请使用对应的 vless:// 链接';

export function realityNodeURIError(raw: string): string {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return '请填写有效的 VLESS TCP REALITY 节点链接'; }
  const params = url.searchParams;
  for (const key of ['type', 'security', 'pbk', 'sni', 'sid', 'flow', 'encryption']) {
    if (params.getAll(key).length > 1) return '节点链接包含重复的连接参数';
  }
  if (url.protocol !== 'vless:' || !['', 'tcp', 'raw'].includes((params.get('type') ?? '').toLowerCase()) || params.get('security')?.toLowerCase() !== 'reality') return profileError;
  if (!url.hostname || !Number.isInteger(Number(url.port)) || Number(url.port) < 1 || Number(url.port) > 65535) return '节点链接须包含有效地址及 1–65535 的端口';
  let uuid: string;
  try { uuid = decodeURIComponent(url.username); } catch { return '节点链接中的 UUID 无效'; }
  if (url.password || !/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(uuid)) return '节点链接中的 UUID 无效';
  const sni = params.get('sni') ?? '';
  if (!sni || sni.length > 253 || !sni.replace(/\.$/, '').split('.').every(label => /^[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?$/i.test(label))) return '节点链接须包含有效的 REALITY SNI（sni）';
  const key = params.get('pbk') ?? '';
  try {
    const decoded = atob(key.replace(/-/g, '+').replace(/_/g, '/') + '=');
    if (!/^[a-z\d_-]{43}$/i.test(key) || decoded.length !== 32 || btoa(decoded).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') !== key) return 'REALITY 公钥（pbk）须为 32 字节 Base64URL 字符串';
  } catch { return 'REALITY 公钥（pbk）须为 32 字节 Base64URL 字符串'; }
  const shortId = params.get('sid') ?? '';
  if (!/^(?:[\da-f]{2}){0,8}$/i.test(shortId)) return 'Short ID（sid）须为空或最多 16 位的偶数位十六进制字符串';
  if (!['', 'xtls-rprx-vision'].includes(params.get('flow') ?? '')) return 'Flow 仅支持留空或 xtls-rprx-vision';
  if (!['', 'none'].includes(params.get('encryption') ?? '')) return 'VLESS encryption 仅支持 none';
  return '';
}

export function isRealityNodeProfile(row: Row): boolean {
  if (row.managementError) return false;
  if (String(row.uri ?? '').trim()) return realityNodeURIError(String(row.uri)) === '';
  const transport = String(row.transport ?? '').replace(/\s+/g, '').toLowerCase();
  const security = String(row.security ?? '').trim().toLowerCase() || (transport.endsWith('/reality') ? 'reality' : '');
  return String(row.protocol ?? '').trim().toLowerCase() === 'vless'
    && ['', 'tcp', 'raw', 'tcp/reality', 'raw/reality'].includes(transport)
    && ['', 'tcp', 'raw'].includes(String(row.network ?? '').trim().toLowerCase())
    && security === 'reality';
}
