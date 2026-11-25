import { HAS_REMOTE_API } from '@/config/brand';
import type { Employee, Role, SessionUser } from '@/types/domain';
import { applyRemoteDatabase } from '../demo/store';
import { AppError, errorMessage } from '../errors';
import { getSessionUser, setSessionUser } from '../session';
import { apiRequest, clearTokens, getTokens, hasTokens, setTokens, type Tokens } from './client';
import { emptyDatabase, toDatabase, type RemoteSnapshot } from './snapshot';

interface RemoteUser {
  employeeId: string;
  name: string;
  email: string;
  role: Role;
  isActive?: boolean;
  createdAt?: string;
}

interface LoginResponse extends Tokens {
  user: RemoteUser;
}

function toSessionUser(user: RemoteUser): SessionUser {
  return {
    employeeId: user.employeeId,
    name: user.name,
    email: user.email,
    role: user.role,
  };
}

function toEmployee(user: RemoteUser): Employee {
  return {
    id: user.employeeId,
    name: user.name,
    email: user.email,
    password: '',
    role: user.role,
    isActive: user.isActive ?? true,
    createdAt: user.createdAt ?? '',
  };
}

async function hydratePublic(): Promise<void> {
  const snapshot = await apiRequest<RemoteSnapshot>('/bootstrap/', { auth: false });
  applyRemoteDatabase(toDatabase(snapshot));
}

async function hydrateAuthenticated(): Promise<void> {
  const snapshot = await apiRequest<RemoteSnapshot>('/bootstrap/');
  applyRemoteDatabase(toDatabase(snapshot));
}

/** Used by the app shell once, before the first screen renders. */
export async function initializeRemoteSession(): Promise<void> {
  if (!HAS_REMOTE_API) return;
  if (!hasTokens()) {
    setSessionUser(null);
    applyRemoteDatabase(emptyDatabase());
    await hydratePublic();
    return;
  }
  try {
    const me = await apiRequest<RemoteUser>('/auth/me/');
    setSessionUser(toSessionUser(me));
    await hydrateAuthenticated();
  } catch (error) {
    if (!hasTokens()) {
      setSessionUser(null);
      await hydratePublic();
      return;
    }
    throw error;
  }
}

export async function loginRemote(email: string, password: string): Promise<Employee> {
  const data = await apiRequest<LoginResponse>('/auth/login/', {
    method: 'POST',
    body: { email: email.trim(), password },
    auth: false,
  });
  setTokens({ access: data.access, refresh: data.refresh });
  setSessionUser(toSessionUser(data.user));
  try {
    await hydrateAuthenticated();
  } catch (error) {
    clearTokens();
    setSessionUser(null);
    applyRemoteDatabase(emptyDatabase());
    throw new AppError(
      `Signed in, but the bakery data could not be loaded. ${errorMessage(error)}`,
    );
  }
  return toEmployee(data.user);
}

export async function logoutRemote(): Promise<void> {
  const tokens = getTokens();
  let serverError: unknown = null;
  if (tokens) {
    try {
      await apiRequest<void>('/auth/logout/', {
        method: 'POST',
        body: { refresh: tokens.refresh },
      });
    } catch (error) {
      serverError = error;
    }
  }
  clearTokens();
  setSessionUser(null);
  applyRemoteDatabase(emptyDatabase());
  await hydratePublic();
  if (serverError) {
    throw new AppError(
      'You were signed out on this device, but the server session could not be closed. ' +
        errorMessage(serverError),
    );
  }
}

/** Pulls the authoritative snapshot again; never falls back to demo data. */
export async function refreshRemoteSnapshot(): Promise<void> {
  if (!HAS_REMOTE_API) return;
  if (hasTokens()) await hydrateAuthenticated();
  else await hydratePublic();
}

export async function synced<T>(action: string, result: T): Promise<T> {
  if (!HAS_REMOTE_API || !getSessionUser()) return result;
  try {
    await refreshRemoteSnapshot();
  } catch (error) {
    throw new AppError(
      `${action} succeeded on the server, but the screen could not be refreshed. ` +
        `${errorMessage(error)} Reload to see the latest data before repeating the action.`,
    );
  }
  return result;
}

export function newIdempotencyKey(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${random}`;
}
