const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB'];

export function trafficBytes(gib: unknown): number | null {
  if (typeof gib !== 'number' && (typeof gib !== 'string' || gib.trim() === '')) return null;
  const bytes = Number(gib) * 1024 ** 3;
  return Number.isFinite(bytes) && bytes >= 0 ? bytes : null;
}

function trafficUnit(bytes: number) {
  let index = 0;
  while (index < units.length - 1 && bytes >= 1024 ** (index + 1)) index++;
  return { unit: units[index], divisor: 1024 ** index };
}

export function formatTrafficBytes(bytes: number): string {
  const { unit, divisor } = trafficUnit(bytes);
  return `${Number((bytes / divisor).toFixed(2))} ${unit}`;
}

export function trafficScale(values: number[]) {
  const peak = values.reduce((max, value) => Number.isFinite(value) ? Math.max(max, value) : max, 0);
  const { unit, divisor } = trafficUnit(peak);
  const targetStep = Math.max(peak / divisor / 3, unit === 'B' ? 1 : 0);
  const magnitude = 10 ** Math.floor(Math.log10(targetStep));
  const step = ([1, 2, 2.5, 5, 10].find(value => value * magnitude >= targetStep) ?? 10) * magnitude;
  return {
    maximum: step * 3 * divisor,
    labels: [3, 2, 1, 0].map(value => `${Number((step * value).toFixed(2))} ${unit}`)
  };
}

export type TrafficPeriod = '1h' | '6h' | '24h';

export type MinuteTrafficSample = {
  at: number;
  bytes: number;
  x: number;
  gap: boolean;
  label: string;
};

const minute = 60_000;
const windowHours: Record<TrafficPeriod, number> = { '1h': 1, '6h': 6, '24h': 24 };
const trafficTime = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Shanghai', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
});
const trafficDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Shanghai', year: 'numeric', month: '2-digit', day: '2-digit'
});

function validTimestamp(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= 8.64e15;
}

export function formatTrafficTime(at: number, includeDate = false): string {
  if (!validTimestamp(at)) return '';
  const time = trafficTime.format(at);
  if (!includeDate) return time;
  const parts = trafficDate.formatToParts(at);
  const date = ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-');
  return `${date} ${time}`;
}

export function buildMinuteTraffic(rows: unknown, period: TrafficPeriod, to: number | null, from?: number | null) {
  const duration = (windowHours[period] ?? 1) * 60 * minute;
  const validWindow = validTimestamp(to) && to > 0;
  const windowTo = validWindow ? to : null;
  const windowFrom = windowTo === null ? null : Math.max(0, Math.floor(windowTo / minute) * minute - duration + minute, validTimestamp(from) ? from : 0);
  const samples: MinuteTrafficSample[] = [];
  const segments: MinuteTrafficSample[][] = [];
  const ticks: { at: number; x: number; label: string }[] = [];

  if (windowFrom !== null && windowTo !== null && windowFrom <= windowTo) {
    const span = windowTo - windowFrom;
    const buckets = new Map<number, MinuteTrafficSample>();
    for (const row of Array.isArray(rows) ? rows : []) {
      if (row === null || typeof row !== 'object') continue;
      const at: unknown = row.at;
      const bytes = trafficBytes(row.total);
      if (!validTimestamp(at) || at % minute !== 0 || at < windowFrom || at > windowTo || bytes === null) continue;
      buckets.set(at, {
        at, bytes,
        x: span > 0 ? (at - windowFrom) / span * 100 : 50,
        gap: row.gap === true || buckets.get(at)?.gap === true,
        label: formatTrafficTime(at)
      });
    }
    samples.push(...[...buckets.values()].sort((left, right) => left.at - right.at));
    if (samples.length) segments.push(samples);
    for (let index = 0; index <= (span > 0 ? 4 : 0); index++) {
      const at = windowFrom + span * index / 4;
      ticks.push({ at, x: span > 0 ? index * 25 : 50, label: formatTrafficTime(at) });
    }
  }

  return {
    samples, segments, ticks,
    from: windowFrom,
    to: windowTo,
    scale: trafficScale(samples.map(sample => sample.bytes)),
    totalBytes: samples.reduce((total, sample) => total + sample.bytes, 0)
  };
}
