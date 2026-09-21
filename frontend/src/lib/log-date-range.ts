export type LogDateRange = { startDate: string; endDate: string };
export type LogDeletePreview = LogDateRange & { timeZone: string; total: number; deletable: number; protected: number; fingerprint: string };
export type LogDeleteResult = LogDateRange & { timeZone: string; total: number; deleted: number; protected: number };

export function beijingDate(now = new Date()): string {
  return new Date(now.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(value + 'T00:00:00Z');
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function logDateRangeError(range: LogDateRange): string {
  if (!range.startDate || !range.endDate) return '请选择开始日期和结束日期';
  if (!validDate(range.startDate) || !validDate(range.endDate)) return '请选择有效日期';
  if (range.startDate > range.endDate) return '结束日期不能早于开始日期';
  return '';
}

export function sameLogDateRange(left: LogDateRange, right: LogDateRange): boolean {
  return left.startDate === right.startDate && left.endDate === right.endDate;
}
