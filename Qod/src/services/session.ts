import type { SessionUser } from '@/types/domain';

const SESSION_KEY = 'seasons-cake.session.v1';

function loadSession(): SessionUser | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as SessionUser) : null;
  } catch {
    return null;
  }
}

let current: SessionUser | null = loadSession();
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function getSessionUser(): SessionUser | null {
  return current;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setSessionUser(user: SessionUser | null): void {
  current = user;
  try {
    if (typeof localStorage !== 'undefined') {
      if (user) localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      else localStorage.removeItem(SESSION_KEY);
    }
  } catch {
    // Session persistence is best-effort in the demo adapter.
  }
  emit();
}
