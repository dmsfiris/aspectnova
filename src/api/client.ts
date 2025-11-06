// src/api/client.ts
/* Centralized fetch wrapper with:
 * - Base URL from env
 * - Optional auth header with auto 401 → refresh → retry (once)
 * - Token storage delegated to src/lib/secure-store (native: SecureStore; web: memory/session)
 * - Safe JSON helpers (get/post/patch/put/delete)
 * - Typed APIError for uniform error handling
 * - DEBUG LOGS toggled by API_DEBUG=1 (via app config) or __DEV__
 * - Refresh mutex (serialize concurrent refreshes)
 * - Optional idempotent backoff for transient errors on GET
 */
import { env } from "@/config/env";
import {
  getAccessToken as ssGet,
  setAccessToken as ssSet,
  clearAccessToken as ssClear
} from "@/lib/secure-store";

// ---------- Config ----------
export const BASE_URL: string = env.API_BASE_URL;
if (!BASE_URL || typeof BASE_URL !== "string") {
  throw new Error("[api] Missing env.API_BASE_URL");
}

// Allow API_DEBUG=1 (via app.config.ts extra) or __DEV__
let apiDebug: unknown;
if (typeof env === "object" && env && "API_DEBUG" in env) {
  apiDebug = (env as { API_DEBUG?: unknown }).API_DEBUG;
}
const DEBUG_API: boolean =
  apiDebug === "1" ||
  apiDebug === 1 ||
  (typeof __DEV__ !== "undefined" && __DEV__ === true);

function dbg(...args: unknown[]): void {
  if (DEBUG_API) {
    // eslint-disable-next-line no-console
    console.log("[api]", ...args);
  }
}

// ---------- Errors ----------
export class APIError extends Error {
  status: number;
  url: string;
  data: unknown;

  constructor(message: string, opts: { status: number; url: string; data?: unknown }) {
    super(message);
    this.name = "APIError";
    this.status = opts.status;
    this.url = opts.url;
    this.data = opts.data;
    Object.setPrototypeOf(this, APIError.prototype);
  }
}

// ---------- Token store (delegates to secure-store) ----------
const TokenStore = {
  get: (): Promise<string | null> => ssGet(),
  set: (token: string | null): Promise<void> => ssSet(token),
  clear: (): Promise<void> => ssClear()
};

// ---------- Utilities ----------
// Pass through ANY absolute URL (supports mock://, data:, custom schemes, etc.)
function toURL(input: string): string {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return input;
  const base = BASE_URL.replace(/\/+$/, "");
  const path = input.replace(/^\/+/, "");
  return `${base}/${path}`;
}

function mergeHeaders(a?: HeadersInit, b?: HeadersInit): Headers {
  const h = new Headers(a ?? {});
  const x = new Headers(b ?? {});
  x.forEach((v, k) => h.set(k, v));
  return h;
}

function jsonHeaders(existing?: HeadersInit): Headers {
  const h = new Headers(existing ?? {});
  if (!h.has("Content-Type")) {
    h.set("Content-Type", "application/json");
  }
  return h;
}

/**
 * Read response body once and try to parse JSON; otherwise return raw text or null.
 */
async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text; // return raw text for diagnostics
  }
}

// Typed wrapper (lets callers specify <T> cleanly)
async function safeJsonTyped<T>(res: Response): Promise<T> {
  return (await safeJson(res)) as T;
}

// Compose caller's AbortSignal with our timeout signal, with a safe fallback
function composeSignals(a?: AbortSignal, b?: AbortSignal): AbortSignal | undefined {
  const AS = AbortSignal as unknown as {
    any?: (signals: AbortSignal[]) => AbortSignal;
  };
  if (typeof AS.any === "function") {
    const list: AbortSignal[] = [];
    if (a) list.push(a);
    if (b) list.push(b);
    return AS.any(list);
  }
  if (!a) return b;
  if (!b) return a;

  const controller = new AbortController();

  const abortWith = (s: AbortSignal): void => {
    const r = (s as { reason?: unknown }).reason;
    if (r !== undefined) controller.abort(r);
    else controller.abort();
  };

  if (a.aborted) abortWith(a);
  if (b.aborted) abortWith(b);

  const onAbortA = () => abortWith(a);
  const onAbortB = () => abortWith(b);
  a.addEventListener("abort", onAbortA);
  b.addEventListener("abort", onAbortB);
  return controller.signal;
}

// Helper to perform a fetch with its own timeout (composed with caller signal)
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const timeoutCtrl = new AbortController();
  const timeoutId = setTimeout(() => timeoutCtrl.abort(), timeoutMs);
  try {
    const signal = composeSignals(init.signal, timeoutCtrl.signal);
    const res = await fetch(url, { ...init, signal });
    dbg("← FETCH status", res.status, url);
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

// ---------- Refresh flow (with mutex) ----------
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshPromise) {
    dbg("… waiting for in-flight refresh");
    return refreshPromise;
  }

  const url = toURL("/auth/refresh");
  refreshPromise = (async () => {
    try {
      dbg("→ REFRESH POST", url);
      const res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({})
      });
      dbg("← REFRESH status", res.status);
      if (!res.ok) return null;

      const data = await safeJsonTyped<{ accessToken?: string } | null>(res);
      const next = data?.accessToken ?? null;
      if (next) {
        await TokenStore.set(next);
        dbg("✓ REFRESH stored new token (len)", next.length);
      } else {
        dbg("✗ REFRESH missing accessToken in response");
      }
      return next;
    } catch (e) {
      dbg("✗ REFRESH failed", e);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export type ApiFetchOptions = {
  /** Add Bearer token from secure store. Default: true */
  auth?: boolean;
  /** On 401, try refresh once and retry. Default: true */
  retryOn401?: boolean;
  /** Throw APIError on !res.ok. Default: true */
  throwOnHTTPError?: boolean;
  /** Per-request timeout in ms. Default: 20000 */
  timeoutMs?: number;
  /** Idempotent backoff retries for transient GET errors. Default: 2 */
  idempotentRetries?: number;
};

const DEFAULT_FETCH_OPTS: Required<Omit<ApiFetchOptions, "idempotentRetries">> & {
  idempotentRetries: number;
} = {
  auth: true,
  retryOn401: true,
  throwOnHTTPError: true,
  timeoutMs: 20000,
  idempotentRetries: 2
};

// ---------- Core fetch ----------
export async function apiFetch(
  input: string,
  init: RequestInit = {},
  options: ApiFetchOptions = {}
): Promise<Response> {
  const opts = { ...DEFAULT_FETCH_OPTS, ...options };

  const headers = mergeHeaders({ Accept: "application/json" }, init.headers ?? {});
  const token = opts.auth ? await TokenStore.get() : null;
  if (opts.auth && token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const url = toURL(input);
  const method = (init.method ?? "GET").toUpperCase();
  const isGet = method === "GET";
  const transientStatuses = [408, 425, 429, 500, 502, 503, 504] as const;
  let remainingIdempotent = isGet ? opts.idempotentRetries : 0;

  dbg("→ FETCH", {
    url,
    method,
    auth: opts.auth,
    hasToken: Boolean(token),
    retryOn401: opts.retryOn401,
    credentials: init.credentials ?? "include"
  });

  // Track the headers we should use for all subsequent attempts (may update after refresh)
  let currentHeaders = headers;

  // Initial request with timeout
  let res: Response = await fetchWithTimeout(
    url,
    {
      ...init,
      method,
      headers: currentHeaders,
      credentials: init.credentials ?? "include"
    },
    opts.timeoutMs
  );

  // Retry once on 401 with refreshed token (serialized)
  if (res.status === 401 && opts.retryOn401) {
    dbg("401 detected → attempting refresh");
    const next = await refreshAccessToken();
    if (next) {
      const retryHeaders = new Headers(currentHeaders);
      retryHeaders.set("Authorization", `Bearer ${next}`);
      currentHeaders = retryHeaders;

      res = await fetchWithTimeout(
        url,
        {
          ...init,
          method,
          headers: currentHeaders,
          credentials: init.credentials ?? "include"
        },
        opts.timeoutMs
      );
      dbg("← RETRY status", res.status);
    }
  }

  // Optional idempotent backoff for transient errors on GET
  const isTransient = (code: number): boolean =>
    (transientStatuses as readonly number[]).includes(code);

  while (!res.ok && isGet && remainingIdempotent > 0 && isTransient(res.status)) {
    const attempt =
      (options.idempotentRetries ?? DEFAULT_FETCH_OPTS.idempotentRetries) -
      remainingIdempotent +
      1;
    const waitMs = Math.min(1500 * attempt, 4000);
    dbg(
      `transient ${res.status} → backoff ${waitMs}ms (attempt ${attempt}/${
        options.idempotentRetries ?? DEFAULT_FETCH_OPTS.idempotentRetries
      })`
    );
    await new Promise<void>(r => setTimeout(r, waitMs));

    remainingIdempotent -= 1;

    res = await fetchWithTimeout(
      url,
      {
        ...init,
        method,
        headers: currentHeaders, // ← use latest headers (post-refresh)
        credentials: init.credentials ?? "include"
      },
      opts.timeoutMs
    );
  }

  if (opts.throwOnHTTPError && !res.ok) {
    const data = await safeJson(res);
    dbg("✗ HTTP error", res.status, data);
    throw new APIError(`HTTP ${res.status}`, { status: res.status, url, data });
  }

  return res;
}

// ---------- JSON convenience helpers ----------
export async function getJSON<T>(
  path: string,
  init: RequestInit = {},
  opts?: ApiFetchOptions
): Promise<T> {
  const res = await apiFetch(path, { ...init, method: "GET" }, opts);
  return safeJsonTyped<T>(res);
}

export async function postJSON<T>(
  path: string,
  body?: unknown,
  init: RequestInit = {},
  opts?: ApiFetchOptions
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = isForm ? init.headers : jsonHeaders(init.headers);
  const res = await apiFetch(
    path,
    {
      ...init,
      method: "POST",
      headers,
      body: isForm ? body : body != null ? JSON.stringify(body) : undefined
    },
    opts
  );
  return safeJsonTyped<T>(res);
}

export async function patchJSON<T>(
  path: string,
  body?: unknown,
  init: RequestInit = {},
  opts?: ApiFetchOptions
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = isForm ? init.headers : jsonHeaders(init.headers);
  const res = await apiFetch(
    path,
    {
      ...init,
      method: "PATCH",
      headers,
      body: isForm ? body : body != null ? JSON.stringify(body) : undefined
    },
    opts
  );
  return safeJsonTyped<T>(res);
}

export async function putJSON<T>(
  path: string,
  body?: unknown,
  init: RequestInit = {},
  opts?: ApiFetchOptions
): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const headers = isForm ? init.headers : jsonHeaders(init.headers);
  const res = await apiFetch(
    path,
    {
      ...init,
      method: "PUT",
      headers,
      body: isForm ? body : body != null ? JSON.stringify(body) : undefined
    },
    opts
  );
  return safeJsonTyped<T>(res);
}

export async function deleteJSON<T>(
  path: string,
  init: RequestInit = {},
  opts?: ApiFetchOptions
): Promise<T> {
  const res = await apiFetch(path, { ...init, method: "DELETE" }, opts);
  return safeJsonTyped<T>(res);
}

// ---------- High-level auth helpers ----------
export async function loginWithPassword(input: {
  email: string;
  password: string;
}): Promise<{ accessToken: string }> {
  const url = toURL("/auth/login");
  dbg("→ LOGIN POST", url);

  const res = await fetch(url, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(input)
  });

  dbg("← LOGIN status", res.status);

  if (!res.ok) {
    const data = await safeJson(res);
    dbg("✗ LOGIN failed", data);
    throw new APIError("Login failed", { status: res.status, url, data });
  }

  const data = await safeJsonTyped<{ accessToken?: string } | null>(res);
  const token = data?.accessToken ?? null;
  if (!token) {
    dbg("✗ LOGIN missing accessToken");
    throw new APIError("No access token in response", { status: res.status, url, data });
  }

  await TokenStore.set(token);
  dbg("✓ LOGIN success; token length:", token.length);
  return { accessToken: token };
}

export async function getAccessToken(): Promise<string | null> {
  const t = await TokenStore.get();
  dbg("getAccessToken →", t ? `length ${t.length}` : "null");
  return t;
}

export async function clearSession(): Promise<void> {
  dbg("clearSession → clear token then POST /auth/logout");
  await TokenStore.clear();
  try {
    const url = toURL("/auth/logout");
    const res = await fetch(url, {
      method: "POST",
      credentials: "include"
    });
    dbg("← LOGOUT status", res.status);
  } catch (e) {
    dbg("LOGOUT error (ignored)", e);
  }
}

// ---------- Friendly surface (current call sites use this) ----------
export const api = {
  get: <T>(path: string, opts?: ApiFetchOptions) => getJSON<T>(path, {}, opts),
  post: <T>(path: string, body?: unknown, opts?: ApiFetchOptions) =>
    postJSON<T>(path, body, {}, opts),
  put: <T>(path: string, body?: unknown, opts?: ApiFetchOptions) =>
    putJSON<T>(path, body, {}, opts),
  patch: <T>(path: string, body?: unknown, opts?: ApiFetchOptions) =>
    patchJSON<T>(path, body, {}, opts),
  delete: <T>(path: string, opts?: ApiFetchOptions) => deleteJSON<T>(path, {}, opts)
};
