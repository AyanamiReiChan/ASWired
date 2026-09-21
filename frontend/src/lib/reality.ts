import type { Row } from './data';

export const realityLabels: Record<string, string> = {
  target: '目标地址 / Target', serverNames: '允许的 SNI 域名', privateKey: 'Reality 私钥', publicKey: '客户端公钥',
  shortIds: 'Short ID 列表', allowEmptyShortId: '允许空 Short ID', xver: 'PROXY protocol',
  minClientVer: '最低客户端版本', maxClientVer: '最高客户端版本',
  maxTimeDiff: '最大时间差 / 毫秒', realityShow: 'Reality 调试日志'
};

export function usesReality(row: Row): boolean {
  return /reality/i.test(String(row.transport ?? ''));
}

export function withRealityFields(row: Row): Row {
  const ids = row.shortIds;
  return {
    ...row,
    target: row.target ?? row.dest ?? '',
    sni: row.sni ?? (Array.isArray(row.serverNames) ? row.serverNames.join(', ') : ''),
    privateKey: row.privateKey ?? '', publicKey: row.publicKey ?? '',
    shortIds: Array.isArray(ids) ? ids.filter(id => id !== '').join(', ') : ids ?? '',
    allowEmptyShortId: row.allowEmptyShortId ?? (Array.isArray(ids) && ids.includes('')),
    xver: String(row.xver ?? '0'), minClientVer: row.minClientVer ?? '',
    maxClientVer: row.maxClientVer ?? '', maxTimeDiff: row.maxTimeDiff ?? 0,
    realityShow: row.realityShow ?? false
  };
}

export function realityValidationError(row: Row): string {
  if (!String(row.target ?? '').trim()) return '请填写 Reality 目标地址';
  const names = String(row.sni ?? '').split(/[\s,，]+/).filter(Boolean);
  if (!names.length) return '请填写至少一个允许的 SNI 域名';
  if (names.some(name => /[*\/:]/.test(name))) return 'SNI 请填写具体域名，不含通配符、协议或端口';
  if (!String(row.privateKey ?? '').trim()) return '请填写或生成 Reality 私钥';
  const rawIds = String(row.shortIds ?? '').trim();
  const ids = rawIds ? rawIds.split(/[,，\n]/).map(id => id.trim()) : [];
  if (ids.some(id => !id)) return '空 Short ID 请使用“允许空 Short ID”选项，不要留空列表项';
  if (!ids.length && !row.allowEmptyShortId) return '请填写或生成 Short ID，或明确允许空 Short ID';
  if (ids.some(id => !/^(?:[0-9a-fA-F]{2}){1,8}$/.test(id))) return 'Short ID 须为偶数位十六进制，最多 16 位';
  if (!['0', '1', '2'].includes(String(row.xver))) return 'PROXY protocol 请选择 0、1 或 2';
  for (const key of ['minClientVer', 'maxClientVer']) {
    const value = String(row[key] ?? '').trim();
    if (value && (!/^\d+\.\d+\.\d+$/.test(value) || value.split('.').some(part => Number(part) > 255))) {
      return `${realityLabels[key]}须为 x.y.z，每段为 0–255`;
    }
  }
  if (!Number.isSafeInteger(Number(row.maxTimeDiff)) || Number(row.maxTimeDiff) < 0) return '最大时间差须为非负整数';
  return '';
}

export function normalizeRealityFields(row: Row): Row {
  const ids = String(row.shortIds ?? '').split(/[,，\n]/).map(id => id.trim().toLowerCase()).filter(Boolean);
  return {
    ...row, target: String(row.target).trim(),
    sni: String(row.sni).split(/[\s,，]+/).filter(Boolean).join(', '),
    serverNames: String(row.sni).split(/[\s,，]+/).filter(Boolean),
    privateKey: String(row.privateKey).trim(), publicKey: String(row.publicKey).trim(),
    shortIds: [...new Set([...ids, ...(row.allowEmptyShortId ? [''] : [])])],
    xver: Number(row.xver), maxTimeDiff: Number(row.maxTimeDiff),
    minClientVer: String(row.minClientVer).trim(), maxClientVer: String(row.maxClientVer).trim()
  };
}
