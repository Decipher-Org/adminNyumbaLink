/**
 * Session state for the admin console: who is signed in, and whether they are
 * actually an admin.
 *
 * The second half is the whole reason this differs from the tenant app's
 * provider. Every route in this app calls `/api/v1/admin/*`, which is behind
 * `requireRole(ADMIN)`. A landlord or tenant with valid credentials can sign in
 * to the backend perfectly well — and would then land in a console where all six
 * requests on the first screen answer `403 INSUFFICIENT_PERMISSIONS`. So the role
 * is checked here, at the one place a session comes into existence, and a
 * non-admin is signed back out with a straight answer instead of being let into a
 * shell that cannot work.
 *
 * That is a usability guard, not a security one: the backend is the thing that
 * actually enforces the boundary, and it does so on every request regardless of
 * what this client believes.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import * as authApi from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import type { AuthUser } from "@/lib/api/types";
import { clearSession, getToken, SESSION_CLEARED_EVENT, setToken } from "@/lib/auth/session";

type AuthState = {
  /** null once resolved and signed out; never undefined after `loading` clears. */
  user: AuthUser | null;
  /** True until the stored token has been checked against the server. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  /** Re-read the account — after changing your own name, or another admin's role. */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthState | undefined>(undefined);

const NOT_ADMIN_MESSAGE =
  "That account isn't an administrator. This console is for platform staff — use the main NyumbaLink app instead.";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  /** Guards against a stale response overwriting a newer sign-in/out. */
  const requestId = useRef(0);

  /** Rehydrate from the stored token on first mount. */
  useEffect(() => {
    const id = ++requestId.current;

    if (!getToken()) {
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const session = await authApi.getSession();
        if (id !== requestId.current) return;

        const sessionUser = session?.user ?? null;

        // Two ways to arrive here without an admin: the token outlived its Redis
        // entry (null user), or the account was demoted by another admin while
        // this tab sat open — `PATCH /users/:id/role` revokes sessions, so this is
        // the belt to that braces.
        if (!sessionUser || sessionUser.role !== "ADMIN") {
          clearSession();
          setUser(null);
          return;
        }

        setUser(sessionUser);
      } catch {
        if (id !== requestId.current) return;
        clearSession();
        setUser(null);
      } finally {
        if (id === requestId.current) setLoading(false);
      }
    })();
  }, []);

  /**
   * The API client clears the token on any 401, including from a background
   * request no screen is awaiting. Mirror that into React state so the UI can't
   * keep showing a signed-in console over a dead session.
   */
  useEffect(() => {
    function onCleared() {
      requestId.current++;
      setUser(null);
    }
    window.addEventListener(SESSION_CLEARED_EVENT, onCleared);
    return () => window.removeEventListener(SESSION_CLEARED_EVENT, onCleared);
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await authApi.signIn({ email, password });

    if (!result.token) {
      // Sign-in without a token would leave the app "logged in" but unable to
      // make a single authenticated call.
      throw new ApiError(500, "NO_SESSION_TOKEN", "Sign-in did not return a session token.");
    }

    if (result.user.role !== "ADMIN") {
      // The credentials were right, so a session now exists on the server. End it
      // rather than leaving a usable token lying in a browser that was told no —
      // the token has to be stored briefly for `signOut` to authenticate.
      setToken(result.token);
      try {
        await authApi.signOut();
      } catch {
        // Nothing more to do: the token is dropped locally either way, and it
        // expires on its own.
      }
      clearSession();
      throw new ApiError(403, "NOT_AN_ADMIN", NOT_ADMIN_MESSAGE);
    }

    const id = ++requestId.current;
    setToken(result.token);
    if (id !== requestId.current) return result.user;
    setUser(result.user);
    setLoading(false);
    return result.user;
  }, []);

  const signOut = useCallback(async () => {
    requestId.current++;
    try {
      await authApi.signOut();
    } catch {
      // A failed sign-out still ends the local session — the token is dropped
      // either way, and leaving the operator stuck signed-in would be worse.
    }
    clearSession();
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const session = await authApi.getSession();
    const sessionUser = session?.user ?? null;
    // A null user here means the session died between calls; the 401 handler has
    // already cleared the token, so don't overwrite that with a half-state.
    if (!sessionUser) return;
    if (sessionUser.role !== "ADMIN") {
      clearSession();
      setUser(null);
      return;
    }
    setUser(sessionUser);
  }, []);

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, signOut, refreshUser }),
    [user, loading, signIn, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
  return context;
}
