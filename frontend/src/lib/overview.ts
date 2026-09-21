type RecordLike = Record<string, any>;
export function nonnegative(value: unknown): number | null {
 return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}
export function overviewBytes(value: number | null, rate = false): string {
 if (value === null || !Number.isFinite(value) || value < 0) return '—';
 const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
 let index = 0;
 while (index < units.length - 1 && value >= 1000 ** (index + 1)) index++;
 return `${new Intl.NumberFormat('zh-CN', {maximumFractionDigits: 2}).format(value / 1000 ** index)} ${units[index]}${rate ? '/s' : ''}`;
}
export function serverQuota(server: RecordLike) {
 const bill = server.merchantTraffic;
 const limitGB = nonnegative(bill?.configured ? bill.limitGB : server.limit);
 const limit = limitGB !== null && limitGB > 0 ? limitGB * 1e9 : null;
 // A lifetime NIC counter is not a monthly quota counter.
 const used = bill?.configured ? nonnegative(bill.usedBytes) : null;
 return {limit, used, remaining: limit !== null && used !== null ? Math.max(0, limit - used) : null,
  percent: limit !== null && used !== null ? used / limit * 100 : null,
  unlimited: limitGB === 0, gap: bill?.gap === true};
}
export function quotaSummary(servers: RecordLike[]) {
 const rows = servers.map(serverQuota), finite = rows.filter(row => row.limit !== null);
 const measured = finite.filter(row => row.used !== null);
 return {limit: finite.length ? finite.reduce((sum, row) => sum + row.limit!, 0) : null,
  used: measured.length ? measured.reduce((sum, row) => sum + row.used!, 0) : null,
  remaining: measured.length ? measured.reduce((sum, row) => sum + row.remaining!, 0) : null,
  finite: finite.length, unknown: finite.length - measured.length, unlimited: rows.filter(row => row.unlimited).length,
  unconfigured: rows.filter(row => row.limit === null && !row.unlimited).length, incomplete: rows.some(row => row.gap)};
}
export function liveRates(servers: RecordLike[]) {
 const online = servers.filter(server => server.probeOnline === true);
 const measured = online.filter(server => nonnegative(server.upload) !== null && nonnegative(server.download) !== null);
 return {up: measured.length ? measured.reduce((sum, row) => sum + row.upload, 0) : null,
  down: measured.length ? measured.reduce((sum, row) => sum + row.download, 0) : null,
  measured: measured.length, online: online.length};
}
export function trafficRanking(rows: RecordLike[]): RecordLike[] {
 return rows.filter(row => nonnegative(row.up) !== null && nonnegative(row.down) !== null)
  .map((row): RecordLike => ({...row, bytes: row.up + row.down}))
  .sort((a, b) => b.bytes - a.bytes || String(a.name).localeCompare(String(b.name)));
}
export function dailyTraffic(rows: RecordLike[]) {
 const samples = rows.filter(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && Number.isFinite(row.at) && row.at >= 0 && row.at < 8.64e15 && nonnegative(row.total) !== null)
  .map(row => ({at: row.at as number, date: row.date as string, bytes: row.total * 1024 ** 3, gap: row.gap === true}))
  .sort((a, b) => a.at - b.at);
 const peak = Math.max(0, ...samples.map(row => row.bytes)), magnitude = 10 ** Math.floor(Math.log10(peak || 1));
 return {samples, maximum: Math.ceil((peak || 1) / magnitude) * magnitude, total: samples.reduce((sum, row) => sum + row.bytes, 0)};
}
