/**
 * The real admin surface: `/api/v1/admin/*`.
 *
 * Every route here exists and is enforced by `requireAuth` + `requireRole(ADMIN)`
 * server-side (`src/routes/admin.js`). `GET /admin/dashboard` was added for this
 * console — three grouped counts in one request, replacing six `limit=1` list calls.
 * The families API.md also documents — `GET /admin/payments`, `GET /admin/reports`,
 * `PATCH /admin/reports/:id/resolve` — are **not** mounted in the router, so they are
 * absent from this module rather than stubbed in it. Screens that need those numbers
 * pull from `lib/demo/` and say so on screen.
 */

import { apiFetch, apiFetchPaged, ApiError, type ApiPagination } from "./client";
import { runWithConcurrency } from "./concurrency";
import type { AdminLandlord, AdminUser, Role, UserStatus } from "./types";

export type Paged<T> = { items: T[]; pagination: ApiPagination };

const EMPTY_PAGINATION: ApiPagination = { page: 1, limit: 0, total: 0, totalPages: 0 };

/**
 * The backend always sends `pagination` on list routes, but a defaulted block
 * keeps a screen from crashing on a malformed response — a blank table is a
 * better failure than a white page.
 */
function toPaged<T>(result: { data: T[]; pagination?: ApiPagination }): Paged<T> {
  return {
    items: Array.isArray(result.data) ? result.data : [],
    pagination: result.pagination ?? { ...EMPTY_PAGINATION, total: result.data?.length ?? 0 },
  };
}

// ------------------------------------------------------------------- users

export type ListUsersParams = {
  page?: number;
  limit?: number;
  /** Must be a valid `Role`; anything else is rejected with `VALIDATION_ERROR`. */
  role?: Role | "";
  status?: UserStatus | "";
  /** Case-insensitive `contains` across name and email. */
  search?: string;
  signal?: AbortSignal;
};

export async function listUsers({ signal, ...query }: ListUsersParams = {}): Promise<
  Paged<AdminUser>
> {
  const result = await apiFetchPaged<AdminUser[]>("/admin/users", { query, signal });
  return toPaged(result);
}

export function getUser(id: string, signal?: AbortSignal): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}`, { signal });
}

/**
 * Promote or demote an account.
 *
 * Two consequences the UI has to spell out before the click, because the API
 * gives no undo for either:
 *  - the backend refuses `CANNOT_DEMOTE_SELF` if you change your own role;
 *  - on success it revokes **all** of the target's sessions, signing them out of
 *    every device immediately.
 *
 * Demoting a LANDLORD does not delete their profile or properties; those rows
 * survive and reappear if the role is granted back.
 */
export function changeUserRole(id: string, role: Role): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}/role`, { method: "PATCH", body: { role } });
}

/**
 * Suspend an account. `reason` is required and must be non-empty — it is stored
 * on the user row and shown back on the detail screen, so it is an audit note,
 * not a throwaway. Also revokes every session for that user.
 */
export function suspendUser(id: string, reason: string): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}/suspend`, { method: "PATCH", body: { reason } });
}

/**
 * Lift a suspension. Only valid from `SUSPENDED`: a `DEACTIVATED` account (the
 * user deleted themselves) answers `400 USER_NOT_SUSPENDED`, so the action is
 * hidden rather than offered-and-failed.
 */
export function reinstateUser(id: string): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}/reinstate`, { method: "PATCH" });
}

// --------------------------------------------------------------- landlords

export type ListLandlordsParams = {
  page?: number;
  limit?: number;
  /** `false` is the approval queue; `true` is the approved roll. Omit for both. */
  verified?: boolean;
  /** Filters the *account* status (`user.status`), not the approval state. */
  status?: UserStatus | "";
  /** Matches business name, and the owner's name or email. */
  search?: string;
  signal?: AbortSignal;
};

export async function listLandlords({ signal, ...query }: ListLandlordsParams = {}): Promise<
  Paged<AdminLandlord>
> {
  const result = await apiFetchPaged<AdminLandlord[]>("/admin/landlords", { query, signal });
  return toPaged(result);
}

/**
 * Approve a landlord — the gate that unlocks property creation for them.
 *
 * Takes the **landlord profile id** (`AdminLandlord.id`), not `userId`.
 * Idempotent: re-approving an already-verified landlord succeeds with
 * "Landlord is already approved.", which is why the queue can be optimistic
 * about a double-click without needing to guard it.
 *
 * There is no rejection endpoint. Nothing in the schema records a rejection or a
 * reason, so the mockup's Reject action and Rejection History tab are demo-only.
 */
export function approveLandlord(id: string): Promise<AdminLandlord> {
  return apiFetch<AdminLandlord>(`/admin/landlords/${id}/approve`, { method: "PATCH" });
}

// ----------------------------------------------------------------- counts

export type PlatformCounts = {
  totalUsers: number;
  tenants: number;
  landlords: number;
  admins: number;
  suspended: number;
  pendingApprovals: number;
  /**
   * Live (ACTIVE) listings. `undefined` from the legacy path below, which has no
   * way to ask for it — the caller already fetches a page of properties and reads
   * `pagination.total` for this card, so it fills the gap.
   */
  liveProperties?: number;
};

/** The `GET /admin/dashboard` envelope. See API.md — three grouped counts. */
type DashboardResponse = {
  users: {
    total: number;
    tenants: number;
    landlords: number;
    admins: number;
    active: number;
    suspended: number;
    deactivated: number;
  };
  landlords: { total: number; verified: number; pendingApproval: number };
  properties: { total: number; active: number; draft: number; hidden: number; archived: number };
};

/**
 * The dashboard's headline numbers.
 *
 * Prefers `GET /admin/dashboard` — one request, three grouped queries server-side.
 * Falls back to assembling the same figures from six `limit=1` list calls when that
 * endpoint answers 404.
 *
 * The fallback is not defensive habit: this endpoint was documented in API.md long
 * before it was mounted, so "the route is missing" is a state this console has
 * already had to survive. A 404 here is an unambiguous signal — `/admin/*` runs
 * `requireAuth` before routing, so an unauthenticated or non-admin caller gets 401
 * or 403 and never reaches a 404. Any other error propagates untouched.
 *
 * Neither path is a transaction. A signup landing mid-flight can make the role
 * buckets disagree with the total by one, which is why the cards show counts rather
 * than a reconciled breakdown. The grouped path narrows that window to a single
 * query but does not close it.
 *
 * Real Milestone 1–3 data. The growth percentages beside them are not; those come
 * from `lib/demo/` because no endpoint reports a previous period.
 */
export async function fetchPlatformCounts(signal?: AbortSignal): Promise<PlatformCounts> {
  try {
    const d = await apiFetch<DashboardResponse>("/admin/dashboard", { signal });
    return {
      totalUsers: d.users.total,
      tenants: d.users.tenants,
      landlords: d.users.landlords,
      admins: d.users.admins,
      suspended: d.users.suspended,
      pendingApprovals: d.landlords.pendingApproval,
      liveProperties: d.properties.active,
    };
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 404) throw error;
    return fetchPlatformCountsFromLists(signal);
  }
}

/**
 * The pre-`/admin/dashboard` path: six counts, two at a time.
 *
 * Each call asks for `limit=1` and reads `pagination.total` — the row payload is
 * thrown away, so this is six cheap counts rather than six page loads. They are
 * deliberately *not* issued all at once; six parallel requests is the shape that
 * makes an under-pooled backend return 500s, and `runWithConcurrency` carries the
 * arithmetic.
 *
 * The order below is the order they resolve in, so the two numbers the dashboard
 * leads with — total users and pending approvals — come first.
 */
async function fetchPlatformCountsFromLists(signal?: AbortSignal): Promise<PlatformCounts> {
  const count = async (query: Record<string, string | number>) => {
    const { pagination } = await apiFetchPaged<AdminUser[]>("/admin/users", {
      query: { ...query, limit: 1 },
      signal,
    });
    return pagination?.total ?? 0;
  };

  const [totalUsers, pendingApprovals, tenants, landlords, admins, suspended] =
    await runWithConcurrency([
      () => count({}),
      () =>
        apiFetchPaged<AdminLandlord[]>("/admin/landlords", {
          query: { verified: false, limit: 1 },
          signal,
        }).then(({ pagination }) => pagination?.total ?? 0),
      () => count({ role: "TENANT" }),
      () => count({ role: "LANDLORD" }),
      () => count({ role: "ADMIN" }),
      () => count({ status: "SUSPENDED" }),
    ]);

  return { totalUsers, tenants, landlords, admins, suspended, pendingApprovals };
}
