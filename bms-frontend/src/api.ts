export interface PortalUser {
  id: number;
  username: string;
  displayName: string;
  role: "owner" | "manager" | "employee";
  workspace: "bakery" | "cafe";
  permissions: string[];
  canManageCatalog: boolean;
  location: { id: number; name: string; kind: "home_bakery" | "cafe" | "other" } | null;
  csrfToken?: string;
}

let csrfToken = "";

function versionedApiPath(path: string): string {
  if (!path.startsWith("/api/") || path.startsWith("/api/v1/")) return path;
  return path.replace(/^\/api\//, "/api/v1/");
}

function formatApiError(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    return value.map(formatApiError).filter(Boolean).join(" ");
  }
  if (value && typeof value === "object") {
    const body = value as Record<string, unknown>;
    if (typeof body.detail === "string") return body.detail;
    return Object.entries(body)
      .map(([field, message]) => {
        const detail = formatApiError(message);
        return detail ? `${field}: ${detail}` : "";
      })
      .filter(Boolean)
      .join(" ");
  }
  return undefined;
}

export async function refreshCsrfToken(): Promise<void> {
  const response = await fetch("/api/v1/auth/csrf/", { credentials: "include" });
  const body = await response.json();
  if (!response.ok || typeof body.csrfToken !== "string") {
    throw new Error(body.detail ?? "Could not start a secure session.");
  }
  csrfToken = body.csrfToken;
}

export async function api<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  const isFormData = typeof FormData !== "undefined" && options.body instanceof FormData;
  if (options.body && !isFormData && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (!["GET", "HEAD", "OPTIONS", "TRACE"].includes(method) && csrfToken) {
    headers.set("X-CSRFToken", csrfToken);
  }

  const response = await fetch(versionedApiPath(path), {
    ...options,
    headers,
    credentials: "include",
  });
  const body: unknown = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const message = formatApiError(body) ?? `The request failed (${response.status}).`;
    throw new Error(message);
  }
  return body as T;
}

export async function signIn(username: string, password: string): Promise<PortalUser> {
  await refreshCsrfToken();
  const user = await api<PortalUser>("/api/auth/login/", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  if (user.csrfToken) csrfToken = user.csrfToken;
  return user;
}

export async function signOut(): Promise<void> {
  await api("/api/auth/logout/", { method: "POST", body: "{}" });
  csrfToken = "";
}

export interface ApiList<T> {
  count: number;
  results: T[];
  next: string | null;
  previous: string | null;
}

export async function getListPage<T>(path: string): Promise<ApiList<T>> {
  const response = await api<T[] | ApiList<T>>(path);
  if (!Array.isArray(response)) return response;
  return { count: response.length, results: response, next: null, previous: null };
}

export async function getList<T>(path: string, maxPages = 50): Promise<T[]> {
  const results: T[] = [];
  const visited = new Set<string>();
  let next: string | null = path;

  while (next && visited.size < maxPages) {
    const pagePath = versionedApiPath(next);
    if (visited.has(pagePath)) throw new Error("The API returned a repeated pagination link.");
    visited.add(pagePath);

    const page = await getListPage<T>(pagePath);
    results.push(...page.results);
    if (!page.next) break;

    const nextUrl = new URL(page.next, window.location.origin);
    if (nextUrl.origin !== window.location.origin) {
      throw new Error("The API returned a pagination link outside this site.");
    }
    next = `${nextUrl.pathname}${nextUrl.search}`;
  }

  return results;
}
