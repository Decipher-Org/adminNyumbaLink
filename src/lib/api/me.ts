/**
 * The signed-in admin's own account (`/api/v1/users/me`).
 *
 * These live outside `admin.ts` on purpose: the routes are in `routes/users.js`
 * behind plain `requireAuth`, not `requireRole("ADMIN")`, and they act on
 * `req.user.id` rather than an id in the path. An admin editing themselves is not
 * an admin action — which also means nothing here can touch another account.
 *
 * `DELETE /users/me` exists too (it sets `status: "DEACTIVATED"` and revokes every
 * session) and is deliberately not wrapped. An admin deactivating the account they
 * are signed in with, from a settings page, is a footgun with no undo in the UI.
 */

import { apiFetch } from "./client";
import type { AdminUser } from "./types";

/**
 * `toPublicUser` in the backend omits the suspension columns that
 * `toAdminUser` includes, so this is deliberately not `AdminUser`.
 */
export type MyProfile = Omit<AdminUser, "suspendedAt" | "suspendedReason">;

/**
 * Name and/or phone. Sending `phone` clears `phoneNumberVerified`, and a number
 * already on another account comes back as `409 PHONE_ALREADY_IN_USE`.
 */
export async function updateMyProfile(input: {
  name?: string;
  phone?: string | null;
}): Promise<MyProfile> {
  const { user } = await apiFetch<{ user: MyProfile }>("/users/me", {
    method: "PATCH",
    body: input,
  });
  return user;
}

/**
 * Better Auth's `changePassword` with `revokeOtherSessions: true`, so every other
 * device is signed out — this one keeps its token. A wrong current password comes
 * back as `401 CURRENT_PASSWORD_INCORRECT`.
 */
export async function changeMyPassword(input: {
  currentPassword: string;
  newPassword: string;
}): Promise<void> {
  await apiFetch<Record<string, never>>("/users/me/password", { method: "PATCH", body: input });
}
