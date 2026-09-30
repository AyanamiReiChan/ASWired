import type {Row} from './data';

export const bytesPerGB = 1024 ** 3;

function nonnegative(value: unknown): number | null {
 if (typeof value !== 'number' && !(typeof value === 'string' && /^(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim()))) return null;
 const number = Number(value);
 return Number.isFinite(number) && number >= 0 ? number : null;
}

export function isSharedTraffic(row: Partial<Row> | null | undefined): boolean {
 return row?.trafficMode === 'shared';
}

export function trafficUsageView(row: Partial<Row>) {
 const shared = isSharedTraffic(row);
 const personalBytes = nonnegative(row.usedBytes);
 const personalUsed = personalBytes === null ? nonnegative(row.used) : personalBytes / bytesPerGB;
 const poolBytes = nonnegative(row.poolUsedBytes);
 // A missing pool total is unknown. Never substitute the current member's usage.
 const used = shared ? (poolBytes === null ? null : poolBytes / bytesPerGB) : personalUsed;
 const limit = nonnegative(shared ? row.poolLimit : row.limit);
 const unlimited = limit === 0;
 const remaining = used === null || limit === null || unlimited ? null : Math.max(0, limit - used);
 const percent = used === null || limit === null || unlimited ? null : Math.min(100, Math.max(0, used / limit * 100));
 const members = nonnegative(row.poolMemberCount);
 return {shared, personalUsed, used, limit, unlimited, remaining, percent, members: members !== null && Number.isInteger(members) ? members : null};
}

export function personalTrafficTotal(rows: Partial<Row>[]): number | null {
 let total = 0;
 for (const row of rows) {
  const used = trafficUsageView(row).personalUsed;
  if (used === null) return null;
  total += used;
 }
 return total;
}

export function trafficModeLabel(row: Partial<Row>): string {
 return isSharedTraffic(row) ? '共享流量池' : '独立额度';
}

export function poolResetLabel(row: Partial<Row>): string {
 if (!row.poolCycleStart) return '共享池周期待建立';
 if (!row.poolCycleEnd) return '不自动重置';
 const end = new Date(row.poolCycleEnd);
 return Number.isFinite(end.valueOf()) ? `统一重置：${end.toLocaleString('zh-CN', {hour12: false})}` : '重置时间未知';
}
