import type { Row } from './data';
import type { Field } from './modules';

export function serverOnboardingFields(fields: Field[]): Field[] {
  const keys = ['name', 'address', 'connection', 'agentPort', 'agentUrl', 'komariUUID', 'region', 'provider', 'limit', 'cost', 'expires', 'description'];
  return keys.flatMap(key => {
    const field = fields.find(item => item.key === key);
    if (!field) return [];
    return [{ ...field, required: ['name','address'].includes(key), ...(key === 'address' ? { label: '服务器地址', placeholder: '服务器 IP 或域名' } : {}) }];
  });
}

export function newServerForm(id: string): Row {
  return { id, connection: '自动', agentPort: 23889, agentUrl: '', komariUUID: '', name: '', address: '', region: '', provider: '', limit: null, cost: null, expires: '', description: '' };
}

export function serverOnboardingPayload(form: Row): Row {
  const payload: Row = { id: form.id, name: String(form.name ?? '').trim(), address: String(form.address ?? '').trim(), connection: String(form.connection || '自动'), agentPort: form.agentPort == null || form.agentPort === '' ? 23889 : Number(form.agentPort), agentUrl: String(form.agentUrl ?? '').trim(), xray_mode: 'embedded', probeSource: 'komari', komariUUID: String(form.komariUUID ?? '').trim() };
  if (!['自动','WebSocket','HTTP','轮询'].includes(payload.connection)) throw new Error('请选择有效连接模式');
  if (!Number.isInteger(payload.agentPort) || payload.agentPort < 1 || payload.agentPort > 65535) throw new Error('Agent 管理端口须为 1–65535 的整数');
  for (const key of ['region','provider','expires','description']) payload[key] = String(form[key] ?? '').trim();
  for (const key of ['limit','cost']) {
    const value = form[key];
    if (value != null && value !== '' && (!Number.isFinite(Number(value)) || Number(value) < 0)) throw new Error('流量额度和月成本须为非负数字');
    payload[key] = value == null || value === '' ? null : Number(value);
  }
  return payload;
}
