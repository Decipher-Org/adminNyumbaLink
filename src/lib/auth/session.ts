/**
 * Session token storage for the admin console.
 *
 * The backend issues an **opaque, rolling, Redis-backed** session token — not a
 * JWT — so there is nothing to decode and no refresh token to rotate. The client
 * stores the string, sends it as `Authorization: Bearer`, and treats a `401` as
 * "session over".
 *
 * The key is namespaced away from the tenant/landlord client's
 * (`nyumbalink.session.token`). In local development both apps run on
 * `localhost` — different ports, so different storage origins — but in an
 * environment where they ever share one, an admin token and a tenant token
 * overwriting each other would sign the operator into the wrong app.
 *
 * `localStorage` is used deliberately: the token must survive a page reload, and
 * the alternative (memory only) would sign the user out on every refresh. This
 * accepts the usual XSS exposure of any browser-stored credential; the mitigation
 * is that the app renders no untrusted HTML.
 */

const TOKEN_KEY = "nyumbalink.admin.session.token";

/**
 * Fired whenever the token is cleared — including from inside the API client on
 * a 401, which has no router access. `AuthProvider` listens and redirects.
 */
export const SESSION_CLEARED_EVENT = "nyumbalink-admin:session-cleared";

/** localStorage throws in private-mode Safari and when storage is disabled. */
function safeStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return safeStorage()?.getItem(TOKEN_KEY) ?? null;
}

export function setToken(token: string): void {
  safeStorage()?.setItem(TOKEN_KEY, token);
}

export function clearSession(): void {
  safeStorage()?.removeItem(TOKEN_KEY);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SESSION_CLEARED_EVENT));
  }
}
