const aliases: Record<string, string> = {
  香港:'HK',日本:'JP',新加坡:'SG',美国:'US',德国:'DE',台湾:'TW',韩国:'KR',英国:'GB',加拿大:'CA',法国:'FR',荷兰:'NL',澳大利亚:'AU',中国:'CN',澳门:'MO',UK:'GB'
};
// Restricted to bundled assets; names and flags never become arbitrary image URLs.
const available = new Set(Object.keys(import.meta.glob('/static/flags/??.svg')).map(path => path.slice(-6, -4).toUpperCase()));
const names = new Map<string, string>(Object.entries(aliases).map(([name, code]) => [name.toLowerCase(), code]));
for (const locale of ['zh-CN', 'en']) {
  const display = new Intl.DisplayNames([locale], { type: 'region' });
  for (const code of available) names.set((display.of(code) ?? code).toLowerCase(), code);
}

export function countryCode(...values: unknown[]): string {
  for (const value of values) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (!text) continue;
    const letters = Array.from(text);
    const flag = letters.length === 2 && letters.every(letter => {
      const point = letter.codePointAt(0)!;
      return point >= 0x1f1e6 && point <= 0x1f1ff;
    }) ? letters.map(letter => String.fromCharCode(letter.codePointAt(0)! - 0x1f1e6 + 65)).join('') : '';
    const code = flag || names.get(text.toLowerCase()) || text.toUpperCase();
    if (available.has(code)) return code;
  }
  return '';
}

export function hostTraffic(row: { observation?: Record<string, unknown>; [key: string]: unknown }): { bytes: number; gb: number } | null {
  const billing = row.merchantTraffic as Record<string, unknown> | undefined;
  if (billing?.configured && typeof billing.usedBytes === 'number' && Number.isFinite(billing.usedBytes)) return {bytes:billing.usedBytes,gb:billing.usedBytes/1e9};
  const observation = row.observation;
  const up = observation?.network_tx_bytes;
  const down = observation?.network_rx_bytes;
  if (typeof up !== 'number' || typeof down !== 'number' || !Number.isFinite(up) || !Number.isFinite(down) || up < 0 || down < 0) return null;
  const bytes = up + down;
  return Number.isFinite(bytes) ? { bytes, gb: bytes / 1_000_000_000 } : null;
}

export function monthlyTrafficReset(row: Record<string, unknown>): string | null {
  const billing = row.merchantTraffic as Record<string, unknown> | undefined;
  if (billing?.configured) return `每月 ${billing.resetDay} 日 00:00（${billing.timezone}）重置`;
  // This metadata is set only after the bound Komari agent's monthly reset is configured.
  if (row.probeSource !== 'komari' || row.trafficPeriod !== 'monthly' || !row.komariUUID || row.trafficPeriodKomariUUID !== row.komariUUID) return null;
  const day = row.trafficResetDay;
  if (typeof day !== 'number' || !Number.isInteger(day) || day < 1 || day > 28 || row.trafficResetTimezone !== 'Asia/Shanghai') return null;
  return `每月 ${day} 日 00:00（北京时间）重置`;
}

export function trafficDirection(row: Record<string, unknown>): string {
 const billing=row.merchantTraffic as Record<string,unknown>|undefined;
 return ({upload:'仅上传',download:'仅下载',sum:'双向合计',max:'双向取较大值'} as Record<string,string>)[String(billing?.direction??'sum')]??'双向合计';
}
