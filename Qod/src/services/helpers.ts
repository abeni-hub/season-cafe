import type { Database } from '@/types/domain';
import { AppError } from './errors';

export function roundQty(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function nextCode(db: Database, counterKey: string, prefix: string, pad = 4): string {
  const next = (db.counters[counterKey] ?? 0) + 1;
  db.counters[counterKey] = next;
  return `${prefix}-${String(next).padStart(pad, '0')}`;
}

export function requirePositive(value: number, message: string): void {
  if (!Number.isFinite(value) || value <= 0) throw new AppError(message);
}

export function requireNonEmpty(value: string | undefined, message: string): string {
  if (!value || !value.trim()) throw new AppError(message);
  return value.trim();
}
