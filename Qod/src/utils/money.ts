export function parseMoneyToCents(input: string | number): number {
  const raw = typeof input === 'string' ? input.replace(/[^0-9.-]/g, '') : String(input);
  if (raw.trim() === '' || raw === '-' || raw === '.') return Number.NaN;
  const value = Number(raw);
  if (!Number.isFinite(value)) return Number.NaN;
  return Math.round(value * 100);
}

export function centsToInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function formatCents(cents: number, currency = 'NGN', opts: { compact?: boolean } = {}): string {
  const fractionDigits =
    cents % 100 === 0 || Math.abs(cents) >= 1_000_000 ? 0 : 2;
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: fractionDigits,
      notation: opts.compact ? 'compact' : 'standard',
    }).format(cents / 100);
  } catch {
    return `${currency} ${(cents / 100).toLocaleString('en-NG')}`;
  }
}

export function sumCents(values: number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function quantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
}
