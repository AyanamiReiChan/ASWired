import type { Row } from './data';
import { isRealityNodeProfile, isSupportedNode } from './node-profile';

export const realityClientFormats = [
  { value: 'clash', label: 'Clash Meta' },
  { value: 'singbox', label: 'sing-box' },
  { value: 'qx', label: 'Quantumult X' },
  { value: 'shadowrocket', label: 'Shadowrocket' },
  { value: 'v2ray', label: 'V2Ray' },
  { value: 'egern', label: 'Egern' },
  { value: 'surge', label: 'Surge' },
  { value: 'stash', label: 'Stash' },
  { value: 'loon', label: 'Loon' },
  { value: 'surfboard', label: 'Surfboard' }
];

export function nodeChoices(rows: Row[], selectedIds: string[]) {
  const available = rows.filter(isSupportedNode);
  const supported = new Set(available.map(row => row.id));
  const unavailable = selectedIds.filter(id => !supported.has(id)).map(id => rows.find(row => row.id === id) ?? { id, name: id, protocol: '记录不可用' });
  return { available, unavailable };
}

export function realityNodeChoices(rows: Row[], selectedIds: string[]) {
  const available = rows.filter(isRealityNodeProfile);
  const supported = new Set(available.map(row => row.id));
  const unavailable = selectedIds.filter(id => !supported.has(id)).map(id => rows.find(row => row.id === id) ?? { id, name: id, protocol: '记录不可用' });
  return { available, unavailable };
}

export function realitySpeedtestError(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '节点需要 JSON 对象';
  const node = value as Record<string, unknown>;
  const options = node['reality-opts'];
  if (node.tls !== true || !options || typeof options !== 'object' || Array.isArray(options)
    || typeof (options as Record<string, unknown>)['public-key'] !== 'string'
    || !String((options as Record<string, unknown>)['public-key']).trim()
    || !isRealityNodeProfile({ id: '', protocol: node.type, network: node.network, security: 'reality' })) {
    return '测速仅支持 VLESS TCP REALITY：type 为 vless，network 为 tcp，tls 为 true，并填写 reality-opts.public-key';
  }
  return '';
}

export function nodeSpeedtestError(value: unknown): string {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return '节点需要 JSON 对象';
  const node = value as Row;
  if (!isSupportedNode({ ...node, id: '', protocol: node.type })) return '不支持此节点协议';
  if (!String(node.server ?? '').trim() || !Number.isInteger(Number(node.port)) || Number(node.port) < 1 || Number(node.port) > 65535) return '请填写服务器地址和 1–65535 的端口';
  return '';
}
