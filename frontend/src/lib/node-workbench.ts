import type { Row } from './data';

export const nodeProtocol = (row: Row) => String(row.protocol || '未知').toUpperCase();
export function nodeAddress(row: Row): string {
  const host = String(row.host || row.server || '');
  return host ? `${host.includes(':') && !host.startsWith('[') ? `[${host}]` : host}${row.port ? `:${row.port}` : ''}` : '—';
}
export function renamedNode(name: string, prefix: string, find: string, replacement: string, suffix: string): string {
  return `${prefix}${find ? name.split(find).join(replacement) : name}${suffix}`.trim();
}
