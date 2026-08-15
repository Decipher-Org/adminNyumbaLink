/**
 * Route guards.
 *
 * `<ProtectedRoute>` blocks unauthenticated access. There is no `role` parameter
 * as there is in the tenant app: this console has exactly one audience, and
 * `AuthProvider` refuses to establish a session for anyone else, so a signed-in
 * user here is an admin by construction.
 *
 * The redirect preserves the attempted URL in `?next=`, so signing in returns the
 * operator to the screen they were opening rather than to the dashboard.
 */

import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/lib/auth/AuthProvider";
import { loginPath, safeNextPath } from "@/lib/search-params";

/** Full-page hold while the stored token is verified — avoids a login flash. */
function SessionLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div
        role="status"
        aria-label="Loading"
        className="size-8 animate-spin rounded-full border-2 border-border border-t-primary"
      />
    </div>
  );
}

export function ProtectedRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <SessionLoading />;
  if (!user) return <Navigate to={loginPath(location.pathname + location.search)} replace />;

  return <Outlet />;
}

/**
 * For the login screen: someone already signed in has no business on it.
 *
 * `?next=` is honoured here as well as by the form itself, and that is
 * load-bearing rather than belt-and-braces. Signing in flips `user` to non-null,
 * which re-renders this guard in the same tick as the form's own `navigate(next)`
 * — if the guard only ever sent people to the dashboard, the two would race for
 * the destination and the intended screen would sometimes be dropped. Agreeing on
 * the answer means it doesn't matter which one wins.
 */
export function GuestOnlyRoute() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <SessionLoading />;

  if (user) {
    const next = safeNextPath(new URLSearchParams(location.search).get("next"));
    return <Navigate to={next ?? "/"} replace />;
  }

  return <Outlet />;
}
