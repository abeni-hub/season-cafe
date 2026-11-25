import { useSyncExternalStore } from 'react';
import { getDb, subscribeDb } from '@/services/demo/store';
import { getSessionUser, subscribeSession } from '@/services/session';
import { useMemo } from 'react';
import { roleHasPermission, type Permission } from '@/config/permissions';
import { getSettings } from '@/services/siteService';
import { formatCents } from '@/utils/money';

export function useDb() {
  return useSyncExternalStore(subscribeDb, getDb, getDb);
}

export function useSession() {
  return useSyncExternalStore(subscribeSession, getSessionUser, getSessionUser);
}

export function usePermission(permission: Permission): boolean {
  const session = useSession();
  return session ? roleHasPermission(session.role, permission) : false;
}

export function useCurrency(): string {
  const db = useDb();
  return db.settings.currency;
}

export function useMoney(cents: number, opts: { compact?: boolean } = {}): { value: string; money: (value: number) => string } {
  const currency = useCurrency();
  return useMemo(
    () => ({
      value: formatCents(cents, currency, opts),
      money: (value: number) => formatCents(value, currency, opts),
    }),
    [currency, cents, opts.compact],
  );
}

export function useSettings() {
  const db = useDb();
  return db.settings;
}
