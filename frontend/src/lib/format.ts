const numberFormat = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 2,
  useGrouping: false
});

export function formatNumber(value: unknown): string {
  const number = typeof value === 'number' ? value
    : typeof value === 'string' && /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())
      ? Number(value) : NaN;
  if (!Number.isFinite(number)) return '—';
  const formatted = numberFormat.format(number);
  return formatted === '-0' ? '0' : formatted;
}

export function formatDisplayValue(value: unknown): string {
  return typeof value === 'number' ? formatNumber(value) : String(value ?? '—');
}

export function formatUsagePercent(value: unknown): string {
  return typeof value === 'number' && Number.isFinite(value)
    ? `${formatNumber(value)}%`
    : '未知';
}
