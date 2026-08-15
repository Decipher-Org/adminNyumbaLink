/**
 * The one place that talks to `propertyHubBackend`.
 *
 * The backend answers in **two different shapes**, so this module exposes two
 * callers rather than one:
 *
 *   - `authFetch`  -> `/api/auth/*`  (Better Auth's own raw JSON, e.g. `{token, user}`)
 *   - `apiFetch`   -> `/api/v1/*`   (`{success, data, message, pagination?}`)
 *
 * Callers get the payload already unwrapped and errors already normalised into
 * `ApiError`, so no screen reaches for `res.ok` or `body.data` by hand.
 *
 * This is a copy of the tenant client's `lib/api/client.ts`, differing only in
 * which session module it reads the token from. Keep the two in step.
 */

import { clearSession, getToken } from "@/lib/auth/session";

/** Overridable at build time; the dev default matches the backend's own PORT. */
const BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8080").replace(/\/+$/, "");

export const API_BASE_URL = BASE_URL;

export type ApiPagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

/**
 * A failed request, with the backend's machine-readable code preserved. Screens
 * branch on `code` (e.g. `INSUFFICIENT_PERMISSIONS`, `CANNOT_SUSPEND_SELF`) and
 * fall back to `message` for display.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details: unknown[];

  constructor(status: number, code: string, message: string, details: unknown[] = []) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }

  /** True when the failure is the network/CORS/server-down case, not a 4xx. */
  get isNetworkError(): boolean {
    return this.status === 0;
  }
}

const NETWORK_ERROR_MESSAGE = "Can't reach the server. Check your connection and try again.";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  /** Serialised as JSON unless it is already a FormData (multipart upload). */
  body?: unknown;
  /** Appended as a query string; `undefined`/`""` entries are dropped. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Send `Authorization: Bearer` when a token is stored. Default `true`. */
  auth?: boolean;
  signal?: AbortSignal;
};

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = `${BASE_URL}${path.startsWith("/") ? path : `/${path}`}`;
  if (!query) return url;

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === "") continue;
    params.set(key, String(value));
  }
  const qs = params.toString();
  return qs ? `${url}?${qs}` : url;
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const { method = "GET", body, query, auth = true, signal } = options;

  const headers: Record<string, string> = {};
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;

  // FormData must set its own Content-Type so the multipart boundary survives.
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";

  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  try {
    return await fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
      // Better Auth also sets a session cookie; sending it keeps a browser
      // session working even if localStorage was cleared.
      credentials: "include",
      signal,
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") throw cause;
    throw new ApiError(0, "NETWORK_ERROR", NETWORK_ERROR_MESSAGE);
  }
}

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

/**
 * A 401 means the stored token is gone or expired. Drop it here — at the single
 * choke point — so no caller can leave a dead token behind. `AuthProvider`
 * listens for the resulting event and sends the user to login.
 *
 * A 403 is deliberately **not** treated this way. `PATCH /admin/users/:id/role`
 * revokes the target's sessions, and an admin who demotes themselves would start
 * collecting `403 INSUFFICIENT_PERMISSIONS` — but the token is still valid, so
 * clearing it here would mask a real answer the screen needs to show.
 */
function handleUnauthorized(): void {
  clearSession();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Call the application REST under `/api/v1` and return the unwrapped `data`.
 * Use `apiFetchPaged` when the `pagination` block is needed too — which most
 * admin list screens do, since the totals drive the dashboard counts.
 */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { data } = await apiFetchPaged<T>(path, options);
  return data;
}

export async function apiFetchPaged<T>(
  path: string,
  options: RequestOptions = {},
): Promise<{ data: T; message?: string; pagination?: ApiPagination }> {
  const res = await request(`/api/v1${path}`, options);
  const payload = await readJson(res);

  if (!res.ok) {
    if (res.status === 401) handleUnauthorized();
    const error = isRecord(payload) && isRecord(payload.error) ? payload.error : {};
    throw new ApiError(
      res.status,
      typeof error.code === "string" ? error.code : "UNKNOWN_ERROR",
      typeof error.message === "string" ? error.message : `Request failed (${res.status})`,
      Array.isArray(error.details) ? error.details : [],
    );
  }

  const envelope = isRecord(payload) ? payload : {};
  return {
    data: envelope.data as T,
    message: typeof envelope.message === "string" ? envelope.message : undefined,
    pagination: (envelope.pagination as ApiPagination | undefined) ?? undefined,
  };
}

/**
 * Call Better Auth under `/api/auth` and return its raw JSON untouched.
 *
 * Better Auth does not use the `{success, data}` envelope and reports failures
 * as `{message, code}`, so its errors are normalised into the same `ApiError`
 * the rest of the app already handles.
 */
export async function authFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await request(`/api/auth${path}`, { auth: true, ...options });
  const payload = await readJson(res);

  if (!res.ok) {
    // A 401 from sign-in is a wrong password, not a dead session — clearing on
    // that path would be harmless but misleading, so only clear when a token
    // was actually sent.
    if (res.status === 401 && getToken()) handleUnauthorized();

    const body = isRecord(payload) ? payload : {};
    throw new ApiError(
      res.status,
      typeof body.code === "string" ? body.code : `HTTP_${res.status}`,
      typeof body.message === "string" ? body.message : `Request failed (${res.status})`,
    );
  }

  return payload as T;
}
