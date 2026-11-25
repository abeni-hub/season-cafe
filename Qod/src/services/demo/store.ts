import type { Database } from '@/types/domain';
import { seedDatabase } from './seed';
import { nowIso } from '@/utils/date';
import { uid } from '@/utils/id';
import { getSessionUser } from '@/services/session';
import { HAS_REMOTE_API } from '@/config/brand';
import { AppError } from '@/services/errors';
import { emptyDatabase } from '@/services/api/snapshot';

const DB_KEY = 'seasons-cake.db.v1';
const DB_VERSION = 1;

function loadDatabase(): Database {
  if (HAS_REMOTE_API) return emptyDatabase();
  try {
    if (typeof localStorage === 'undefined') return seedDatabase();
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return seedDatabase();
    const parsed = JSON.parse(raw) as Database;
    if (!parsed || parsed.version !== DB_VERSION) return seedDatabase();
    return parsed;
  } catch {
    return seedDatabase();
  }
}

let current: Database = loadDatabase();
const listeners = new Set<() => void>();

function persist(): void {
  if (HAS_REMOTE_API) return;
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(DB_KEY, JSON.stringify(current));
  } catch {
    // Demo persistence is best-effort; the in-memory copy remains authoritative.
  }
}

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getDb(): Database {
  return current;
}

export function subscribeDb(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Replaces the snapshot with server data. API snapshots are never persisted to localStorage. */
export function applyRemoteDatabase(next: Database): void {
  current = next;
  emit();
}

function actorName(): string {
  return getSessionUser()?.name ?? 'System';
}

export function logActivity(draft: Database, message: string, actor = actorName()): void {
  draft.activity.unshift({ id: uid('act'), message, actor, createdAt: nowIso() });
  draft.activity = draft.activity.slice(0, 80);
}

export function mutateDb<T>(fn: (draft: Database) => T, activity?: string): T {
  if (HAS_REMOTE_API) {
    throw new AppError('This build is connected to the live API; local demo changes are disabled.');
  }
  const draft = structuredClone(current) as Database;
  const result = fn(draft);
  if (activity) logActivity(draft, activity);
  current = draft;
  persist();
  emit();
  return result;
}

export function resetDemoDatabase(): void {
  if (HAS_REMOTE_API) {
    throw new AppError('Demo data reset is unavailable when the app is connected to the live API.');
  }
  current = seedDatabase();
  persist();
  emit();
}
