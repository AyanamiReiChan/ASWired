import type { Row } from './data';

export function isManagedRealityInbound(row: Row): boolean {
  if (String(row.protocol ?? '').trim().toLowerCase() !== 'vless'
    || String(row.transport ?? '').replace(/\s+/g, '').toLowerCase() !== 'tcp/reality') return false;
  for (const [key, expected] of Object.entries({ network: 'tcp', security: 'reality' })) {
    if (row[key] != null && row[key] !== '' && String(row[key]).trim().toLowerCase() !== expected) return false;
  }
  const object = (value: unknown): value is Record<string, unknown> => value != null && typeof value === 'object' && !Array.isArray(value);
  if (row.settings != null && (!object(row.settings) || Object.entries(row.settings).some(([key, value]) => key !== 'decryption' || value !== 'none'))) return false;
  if (row.streamSettings != null && (!object(row.streamSettings) || Object.entries(row.streamSettings).some(([key, value]) => {
    if (key === 'network') return value !== 'tcp';
    if (key === 'security') return value !== 'reality';
    if (key === 'sockopt') return !object(value);
    return true;
  }))) return false;
  return true;
}

export function convertToRealityInbound(row: Row): Row {
  return { ...row, protocol: 'VLESS', transport: 'TCP / Reality', network: 'tcp', security: 'reality', settings: {}, streamSettings: {} };
}
