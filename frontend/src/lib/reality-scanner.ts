import type { Row } from './data';

export type RealityScanResult = {
  id: string;
  target: string;
  host: string;
  ip: string;
  port: number;
  feasible: boolean;
  tls13: boolean;
  h2: boolean;
  x25519: boolean;
  certValid: boolean;
  certChainValid: boolean;
  certChainBytes: number;
  serverNames: string[];
  alpn: string;
  tlsVersion: string;
  curveID: number | string;
  latencyMs: number;
  tcpMs: number;
  handshakeMs: number;
  certificateExpires: string;
  certSubject: string;
  certIssuer: string;
  reason: string;
};

export type RealityScan = {
  scanId: string;
  expiresAt: string;
  source: 'controller' | 'agent';
  serverId?: string;
  serverName?: string;
  results: RealityScanResult[];
  total: number;
  feasibleCount: number;
};

export function scanExpired(scan: RealityScan | null, now = Date.now()): boolean {
  if (!scan) return true;
  const expires = Date.parse(scan.expiresAt);
  return !Number.isFinite(expires) || expires <= now;
}

export function scanResultSelection(scan: RealityScan | null, id: string, serverId: string, now = Date.now()): { target: string; sni: string } | null {
  if (!scan || scanExpired(scan, now) || scan.source !== (serverId ? 'agent' : 'controller') || (scan.serverId || '') !== serverId) return null;
  const result = scan.results.find(row => row.id === id);
  if (!result?.feasible || !result.tls13 || !result.h2 || !result.x25519 || !result.certValid || !result.certChainValid || !result.target || !result.host || result.host.includes('*')) return null;
  return { target: result.target, sni: result.host };
}

export function visibleScanResults(results: RealityScanResult[], feasibleOnly: boolean, order: string): RealityScanResult[] {
  return results.filter(result => !feasibleOnly || result.feasible).sort((a, b) => {
    if (a.feasible !== b.feasible) return a.feasible ? -1 : 1;
    if (order === 'target') return a.target.localeCompare(b.target);
    const latency = (result: RealityScanResult) => Number.isFinite(result.latencyMs) && result.latencyMs > 0 ? result.latencyMs : Infinity;
    return (latency(a) - latency(b)) || a.target.localeCompare(b.target);
  });
}

export function selectedScanResultIds(scan: RealityScan | null, selected: string[], imported: string[], now = Date.now()): string[] {
  if (!scan || scanExpired(scan, now)) return [];
  const selectedSet = new Set(selected), importedSet = new Set(imported);
  return scan.results.filter(result => result.feasible && selectedSet.has(result.id) && !importedSet.has(result.id)).map(result => result.id);
}

export function realityPoolSelection(row: Row): { target: string; sni: string } {
  return { target: String(row.target || `${row.domain}:${row.port || 443}`), sni: String(row.domain || '') };
}
