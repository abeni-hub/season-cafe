import { API_BASE_URL } from '@/config/brand';
import { AppError } from '../errors';
import { setSessionUser } from '../session';

const TOKENS_KEY = 'seasons-cake.tokens.v1';

export interface Tokens {
  access: string;
  refresh: string;
}

export class ApiError extends AppError {
  readonly status: number;
  readonly errors?: Record<string, unknown>;

  constructor(status: number, message: string, errors?: Record<string, unknown>) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.errors = errors;
  }
}

function apiBaseUrl(): string {
  const raw = API_BASE_URL.trim().replace(/\/+$/, '');
  if (/\/api\/v1$/i.test(raw)) return raw;
  if (/\/api$/i.test(raw)) return `${raw}/v1`;
  return `${raw}/api/v1`;
}

function readTokens(): Tokens | null {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(TOKENS_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Tokens>;
    if (!parsed.access || !parsed.refresh) return null;
    return { access: parsed.access, refresh: parsed.refresh };
  } catch {
    return null;
  }
}

export function getTokens(): Tokens | null {
  return readTokens();
}

export function hasTokens(): boolean {
  return readTokens() !== null;
}

export function setTokens(tokens: Tokens): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(TOKENS_KEY, JSON.stringify(tokens));
    }
  } catch {
    throw new AppError('Your browser could not store the sign-in session. Enable local storage and try again.');
  }
}

export function clearTokens(): void {
  try {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKENS_KEY);
  } catch {
    // Clearing best-effort; the in-memory session is cleared by the caller.
  }
}

function expireSession(): void {
  clearTokens();
  setSessionUser(null);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('seasons:auth-expired'));
  }
}

let refreshInFlight: Promise<Tokens | null> | null = null;

async function refreshTokens(refresh: string): Promise<Tokens | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const data = await apiRequest<{ access: string; refresh?: string }>('/auth/refresh/', {
          method: 'POST',
          body: { refresh },
          auth: false,
        });
        const next: Tokens = { access: data.access, refresh: data.refresh ?? refresh };
        setTokens(next);
        return next;
      } catch {
        return null;
      }
    })();
  }
  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  body?: unknown;
  auth?: boolean;
  idempotencyKey?: string;
  signal?: AbortSignal;
  _retried?: boolean;
}

async function parseError(response: Response): Promise<ApiError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  const payload = (body ?? {}) as { detail?: unknown; errors?: unknown };
  const detail = typeof payload.detail === 'string' ? payload.detail : '';
  const fallback =
    response.status === 401
      ? 'Please sign in to continue.'
      : response.status === 403
        ? 'Your role does not allow this action.'
        : response.status === 429
          ? 'Too many requests. Please wait a moment and try again.'
          : `The API rejected the request (HTTP ${response.status}).`;
  return new ApiError(
    response.status,
    detail || fallback,
    payload.errors && typeof payload.errors === 'object'
      ? (payload.errors as Record<string, unknown>)
      : undefined,
  );
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const auth = options.auth !== false;
  const tokens = getTokens();
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && tokens) headers.Authorization = `Bearer ${tokens.access}`;
  if (options.idempotencyKey) headers['Idempotency-Key'] = options.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(`${apiBaseUrl()}${path}`, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: options.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new AppError(
      'Cannot reach the Seasons Cake API. Check your connection and that VITE_API_BASE_URL points at the Django service.',
    );
  }

  if (
    response.status === 401 &&
    auth &&
    tokens?.refresh &&
    !options._retried &&
    !path.startsWith('/auth/login/') &&
    !path.startsWith('/auth/refresh/')
  ) {
    const refreshed = await refreshTokens(tokens.refresh);
    if (refreshed) {
      return apiRequest<T>(path, { ...options, _retried: true });
    }
    expireSession();
    throw new ApiError(401, 'Your session has expired. Please sign in again.');
  }

  if (!response.ok) {
    if (response.status === 401 && auth) expireSession();
    throw await parseError(response);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ApiError(response.status, 'The API returned a response the app could not read.');
  }
}
