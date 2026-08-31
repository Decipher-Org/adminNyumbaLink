/**
 * Notification calls (`/api/v1/notifications`).
 *
 * The backend answers `data: [...]` for the list and `data: {...}` for single
 * mutations, matching the standard envelope. No wrapper keys like `{payments}`
 * here — `apiFetch` / `apiFetchPaged` unwrap directly to the notification DTO.
 */

import { apiFetch, apiFetchPaged, type ApiPagination } from "./client";
import type { Notification, NotificationType } from "./types";

export type NotificationListParams = {
  unreadOnly?: boolean;
  /**
   * Narrow to one type, server-side. Applied to the count as well as the page, so
   * the pagination footer describes the filtered set — which is why this is a query
   * parameter rather than a `.filter()` over whatever page happened to be fetched.
   */
  type?: NotificationType;
  page?: number;
  /** Defaults to 20 server-side, capped at 100. */
  limit?: number;
};

/**
 * The admin's own notifications, newest first.
 */
export async function listNotifications(
  params: NotificationListParams = {},
  signal?: AbortSignal,
): Promise<{ items: Notification[]; pagination?: ApiPagination }> {
  const { data, pagination } = await apiFetchPaged<Notification[]>("/notifications", {
    query: {
      unreadOnly: params.unreadOnly ? "true" : undefined,
      type: params.type,
      page: params.page,
      limit: params.limit,
    },
    signal,
  });
  return { items: data ?? [], pagination };
}

/** Mark a single notification as read. */
export async function markAsRead(id: string, signal?: AbortSignal): Promise<Notification> {
  return apiFetch<Notification>(`/notifications/${id}/read`, {
    method: "PATCH",
    signal,
  });
}

/** Mark all unread notifications as read. Returns the count of updated rows. */
export async function markAllAsRead(signal?: AbortSignal): Promise<{ count: number }> {
  return apiFetch<{ count: number }>("/notifications/read-all", {
    method: "PATCH",
    signal,
  });
}

/** Register this browser's FCM registration token for push delivery. */
export async function registerDeviceToken(
  token: string,
  platform: "android" | "ios" | "web" = "web",
): Promise<void> {
  await apiFetch("/notifications/device-token", {
    method: "POST",
    body: { token, platform },
  });
}

/** Remove a previously registered browser token during a local sign-out/opt-out. */
export async function unregisterDeviceToken(token: string): Promise<{ deleted: boolean }> {
  return apiFetch<{ deleted: boolean }>("/notifications/device-token", {
    method: "DELETE",
    body: { token },
  });
}

/**
 * Cheaply fetch the unread count without transferring the notification bodies.
 * Reads `pagination.total` from a `limit=0` unread-only request.
 *
 * Note: The backend does not support `limit=0`, so we use `limit=1` and ignore
 * the single item returned.
 */
export async function getUnreadCount(signal?: AbortSignal): Promise<number> {
  const { pagination } = await apiFetchPaged<Notification[]>("/notifications", {
    query: { unreadOnly: "true", limit: 1 },
    signal,
  });
  return pagination?.total ?? 0;
}