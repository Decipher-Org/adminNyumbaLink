/**
 * The real admin surface: `/api/v1/admin/*`.
 *
 * Every route here exists and is enforced by `requireAuth` + `requireRole(ADMIN)`
 * server-side (`src/routes/admin.js`). `GET /admin/dashboard` was added for this
 * console — nine grouped counts in one request, replacing six `limit=1` list calls
 * and a separate revenue fetch.
 *
 * `GET /admin/reports` and `PATCH /admin/reports/:id/resolve` are documented in
 * API.md and mounted, but this console has no reports screen yet (Milestone 7), so
 * they are absent from this module rather than stubbed in it.
 */

import {
  apiFetch,
  apiFetchPaged,
  ApiError,
  type ApiPagination,
} from "./client";
import { runWithConcurrency } from "./concurrency";
import type {
  AdminLandlord,
  AdminPayment,
  AdminSubscription,
  AdminUser,
  PaymentDto,
  PaymentPurpose,
  PaymentStatus,
  ReconcileResult,
  RevenuePoint,
  RevenueSeries,
  Role,
  UserStatus,
  AdminReport,
  AdminAuditLog,
  ReportAction,
  ReportReason,
  ReportStatus,
} from "./types";

export type Paged<T> = { items: T[]; pagination: ApiPagination };

const EMPTY_PAGINATION: ApiPagination = {
  page: 1,
  limit: 0,
  total: 0,
  totalPages: 0,
};

/**
 * The backend always sends `pagination` on list routes, but a defaulted block
 * keeps a screen from crashing on a malformed response — a blank table is a
 * better failure than a white page.
 */
function toPaged<T>(result: {
  data: T[];
  pagination?: ApiPagination;
}): Paged<T> {
  return {
    items: Array.isArray(result.data) ? result.data : [],
    pagination: result.pagination ?? {
      ...EMPTY_PAGINATION,
      total: result.data?.length ?? 0,
    },
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

export async function listUsers({
  signal,
  ...query
}: ListUsersParams = {}): Promise<Paged<AdminUser>> {
  const result = await apiFetchPaged<AdminUser[]>("/admin/users", {
    query,
    signal,
  });
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
  return apiFetch<AdminUser>(`/admin/users/${id}/role`, {
    method: "PATCH",
    body: { role },
  });
}

/**
 * Suspend an account. `reason` is required and must be non-empty — it is stored
 * on the user row and shown back on the detail screen, so it is an audit note,
 * not a throwaway. Also revokes every session for that user.
 */
export function suspendUser(id: string, reason: string): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}/suspend`, {
    method: "PATCH",
    body: { reason },
  });
}

/**
 * Lift a suspension. Only valid from `SUSPENDED`: a `DEACTIVATED` account (the
 * user deleted themselves) answers `400 USER_NOT_SUSPENDED`, so the action is
 * hidden rather than offered-and-failed.
 */
export function reinstateUser(id: string): Promise<AdminUser> {
  return apiFetch<AdminUser>(`/admin/users/${id}/reinstate`, {
    method: "PATCH",
  });
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

export async function listLandlords({
  signal,
  ...query
}: ListLandlordsParams = {}): Promise<Paged<AdminLandlord>> {
  const result = await apiFetchPaged<AdminLandlord[]>("/admin/landlords", {
    query,
    signal,
  });
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
 * There is no rejection endpoint. The UI therefore exposes only approval and the
 * separate, durable account-suspension action.
 */
export function approveLandlord(id: string): Promise<AdminLandlord> {
  return apiFetch<AdminLandlord>(`/admin/landlords/${id}/approve`, {
    method: "PATCH",
  });
}

// ---------------------------------------------------------------- payments

export type ListPaymentsParams = {
  page?: number;
  limit?: number;
  status?: PaymentStatus | "";
  purpose?: PaymentPurpose | "";
  /**
   * One free-text term, matched server-side across the M-Pesa receipt, both gateway
   * identifiers, our own reference, the phone number, and the payer's name and email.
   * A phone-shaped term matches on its significant digits, so `0722334455` and
   * `+254722334455` find the same rows.
   */
  search?: string;
  signal?: AbortSignal;
};

/**
 * `GET /admin/payments` — every user's payments, newest first.
 *
 * No `provider` param is threaded even though the backend accepts one: `MPESA` is the
 * only value, so filtering on it is filtering on nothing.
 */
export async function listAdminPayments({
  signal,
  ...query
}: ListPaymentsParams = {}): Promise<Paged<AdminPayment>> {
  const result = await apiFetchPaged<AdminPayment[]>("/admin/payments", {
    query,
    signal,
  });
  return toPaged(result);
}

/**
 * `GET /admin/payments/revenue` — successful payments summed by EAT calendar day.
 *
 * `days` must be 7, 30 or 90; anything else is a `400` from the server rather than a
 * clamp, so don't compute one here.
 *
 * The dashboard does **not** need this call: `GET /admin/dashboard` already embeds its
 * own 30-day series, and both come from one backend helper. Use this for the other two
 * windows.
 */
export function fetchRevenueSeries({
  days = 30,
  signal,
}: { days?: 7 | 30 | 90; signal?: AbortSignal } = {}): Promise<RevenueSeries> {
  return apiFetch<RevenueSeries>("/admin/payments/revenue", {
    query: { days },
    signal,
  });
}

/**
 * A single payment — `/payments/:id`, **not** `/admin/payments/:id`, which does not exist.
 *
 * That is not a mistake. `findOwnedPayment` in `routes/payments.js` skips the ownership
 * check when the caller is an ADMIN, so the user-facing detail route already answers for
 * any payment on the platform. Note the shape difference: this route returns
 * `toPaymentDto` **without** the admin-only `gatewayReference` / `checkoutRequestId` /
 * `user`, so the list is the richer source and this is here for a fresh read after a
 * reconcile.
 */
export function getAdminPayment(
  id: string,
  signal?: AbortSignal,
): Promise<PaymentDto> {
  return apiFetch<PaymentDto>(`/payments/${id}`, { signal });
}

/**
 * The reconcile response plus the envelope's own `message`.
 *
 * The message is the point of the call — see below — and `apiFetch` throws it away, so
 * this one goes through `apiFetchPaged`, which is the only helper that returns the
 * envelope's siblings. The name is about the return shape, not about paging; there is no
 * `pagination` on this route and none is read.
 */
export type ReconcileOutcome = ReconcileResult & { message?: string };

/**
 * Ask PayHero what actually happened to a payment — the answer to "this one is stuck
 * at QUEUED". Same reason as `getAdminPayment` for the non-`/admin` path.
 *
 * Idempotent, and safe to offer without a confirmation step: it writes only what the
 * gateway reports, through the same settlement path as the webhook. **`applied: false`
 * is not an error** — already settled, never reached the provider, and not recognised
 * yet are three different pieces of news, and the backend's `message` words each one.
 * Show that message.
 */
export async function reconcileAdminPayment(
  id: string,
  signal?: AbortSignal,
): Promise<ReconcileOutcome> {
  const { data, message } = await apiFetchPaged<ReconcileResult>(
    `/payments/${id}/reconcile`,
    {
      method: "POST",
      signal,
    },
  );
  return { ...data, message };
}

// ----------------------------------------------------------- subscriptions

export type ListSubscriptionsParams = {
  page?: number;
  limit?: number;
  /** `true` is the renewal-chasing list, `false` the live ones. Omit for both. */
  expired?: boolean;
  propertyId?: string;
  signal?: AbortSignal;
};

/**
 * `GET /admin/subscriptions` — landlord terms, **soonest to expire first**.
 *
 * That ordering is the server's and is deliberate: unlike the other admin lists this
 * one answers "what is about to lapse", not "what happened lately". There is no search
 * param — to find one landlord's terms, go through `/admin/landlords` and filter by
 * `propertyId`.
 */
export async function listAdminSubscriptions({
  signal,
  ...query
}: ListSubscriptionsParams = {}): Promise<Paged<AdminSubscription>> {
  const result = await apiFetchPaged<AdminSubscription[]>(
    "/admin/subscriptions",
    {
      query,
      signal,
    },
  );
  return toPaged(result);
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
  /**
   * Milestones 4 and 5. Optional for the same reason as `liveProperties`, and it
   * matters more here: `fetchPlatformCountsFromLists` cannot produce either block, and
   * a `0` would be indistinguishable from a true count of none. Absent renders as `—`.
   */
  payments?: DashboardPayments;
  subscriptions?: DashboardSubscriptions;
  /**
   * Milestone 10. Live report counts from `GET /admin/dashboard`.
   */
  reports?: DashboardReports;
  recentActivity?: AdminAuditLog[];
};

export type DashboardReports = {
  total: number;
  open: number;
  reviewing: number;
  resolved: number;
  dismissed: number;
};

/**
 * The `payments` block of `GET /admin/dashboard`.
 *
 * `pending` is `PENDING + QUEUED` and all-time on purpose — a payment stuck for three
 * weeks is exactly the one worth surfacing, so windowing it would hide the only figure
 * on the dashboard anyone has to act on. `failed7d` is windowed for the opposite
 * reason: old failures are noise, a spike is a signal.
 *
 * The three revenue totals are sums over `series30d`'s tail, computed server-side from
 * the same array, so a stat card and the chart beside it cannot disagree.
 */
export type DashboardPayments = {
  total: number;
  pending: number;
  succeeded: number;
  failed: number;
  cancelled: number;
  failed7d: number;
  revenueToday: number;
  revenue7d: number;
  revenue30d: number;
  currency: string;
  /** 30 zero-filled daily points, oldest first. */
  series30d: RevenuePoint[];
};

/**
 * The `subscriptions` block.
 *
 * `landlordActive` / `landlordLapsed` count **property terms**; `tenantPassesLive`
 * counts distinct **tenants** holding a live day pass. Two different units — they must
 * never share a denominator or a chart.
 */
export type DashboardSubscriptions = {
  landlordActive: number;
  landlordLapsed: number;
  tenantPassesLive: number;
};

/** The `GET /admin/dashboard` envelope. See API.md. */
export type DashboardResponse = {
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
  properties: {
    total: number;
    active: number;
    draft: number;
    hidden: number;
    archived: number;
  };
  payments: DashboardPayments;
  subscriptions: DashboardSubscriptions;
  reports?: DashboardReports;
  recentActivity?: AdminAuditLog[];
};

/**
 * The dashboard's headline numbers.
 *
 * Prefers `GET /admin/dashboard` — one request, nine grouped queries server-side.
 * Falls back to assembling what it can from six `limit=1` list calls when that
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
 * Every value returned here comes from a backend endpoint.
 */
export async function fetchPlatformCounts(
  signal?: AbortSignal,
): Promise<PlatformCounts> {
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
      payments: d.payments,
      subscriptions: d.subscriptions,
      reports: d.reports,
      recentActivity: d.recentActivity,
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
 * Returns no `payments` or `subscriptions`: there is no list route that would total
 * revenue, and a `0` would read as "nobody has paid". The cards show `—` instead.
 *
 * The order below is the order they resolve in, so the two numbers the dashboard
 * leads with — total users and pending approvals — come first.
 */
async function fetchPlatformCountsFromLists(
  signal?: AbortSignal,
): Promise<PlatformCounts> {
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

  return {
    totalUsers,
    tenants,
    landlords,
    admins,
    suspended,
    pendingApprovals,
  };
}

// ------------------------------------------------------------------ reports

export type ListReportsParams = {
  page?: number;
  limit?: number;
  status?: ReportStatus | "all" | "";
  reason?: ReportReason | "all" | "";
  propertyId?: string;
  search?: string;
  signal?: AbortSignal;
};

export async function listReports({
  signal,
  ...query
}: ListReportsParams = {}): Promise<Paged<AdminReport>> {
  const cleanQuery: Record<string, string | number | undefined> = {};
  if (query.page) cleanQuery.page = query.page;
  if (query.limit) cleanQuery.limit = query.limit;
  if (query.status && query.status !== "all") cleanQuery.status = query.status;
  if (query.reason && query.reason !== "all") cleanQuery.reason = query.reason;
  if (query.propertyId) cleanQuery.propertyId = query.propertyId;
  if (query.search) cleanQuery.search = query.search;

  const result = await apiFetchPaged<AdminReport[]>("/admin/reports", {
    query: cleanQuery,
    signal,
  });
  return toPaged(result);
}

export type ResolveReportPayload = {
  action: ReportAction;
  notes?: string;
};

export async function resolveReport(
  id: string,
  payload: ResolveReportPayload,
): Promise<AdminReport> {
  return apiFetch<AdminReport>(`/admin/reports/${id}/resolve`, {
    method: "PATCH",
    body: payload,
  });
}

// ---------------------------------------------------------------- audit logs

export type ListAuditLogsParams = {
  page?: number;
  limit?: number;
  actor?: string;
  adminId?: string;
  action?: string;
  targetType?: string;
  targetId?: string;
  from?: string;
  to?: string;
  search?: string;
  signal?: AbortSignal;
};

export async function listAuditLogs({
  signal,
  ...query
}: ListAuditLogsParams = {}): Promise<Paged<AdminAuditLog>> {
  const result = await apiFetchPaged<AdminAuditLog[]>("/admin/audit-logs", {
    query,
    signal,
  });
  return toPaged(result);
}
