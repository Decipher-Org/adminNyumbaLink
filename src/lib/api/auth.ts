/**
 * Authentication calls against Better Auth (`/api/auth/*`).
 *
 * The admin console only signs in — it never signs up. `POST /sign-up/email`
 * coerces any self-assigned `ADMIN` down to `TENANT`, so the first admin has to
 * be provisioned server-side with `scripts/create-admin.mjs` (see the backend's
 * RUNNING.md) and every one after that by an existing admin through
 * `PATCH /admin/users/:id/role`. There is deliberately no registration form here.
 */

import { authFetch } from "./client";
import type { AuthResponse, SessionResponse } from "./types";

export function signIn(input: { email: string; password: string }): Promise<AuthResponse> {
  return authFetch<AuthResponse>("/sign-in/email", { method: "POST", body: input, auth: false });
}

/** Rehydrate from a stored token. Resolves to null-ish when the token is dead. */
export function getSession(): Promise<SessionResponse> {
  return authFetch<SessionResponse>("/get-session");
}

export function signOut(): Promise<unknown> {
  return authFetch("/sign-out", { method: "POST" });
}

export type OtpType = "email-verification" | "forget-password" | "sign-in";

/**
 * First step of a password reset. Delivery is a **stub** in this environment:
 * `src/auth/senders.js` only logs the OTP to the backend's console, so an admin
 * who is locked out needs someone with server access to read it. The reset screen
 * says so rather than implying an email is on its way.
 */
export function sendVerificationOtp(input: { email: string; type: OtpType }): Promise<unknown> {
  return authFetch("/email-otp/send-verification-otp", {
    method: "POST",
    body: input,
    auth: false,
  });
}

export function resetPassword(input: {
  email: string;
  otp: string;
  password: string;
}): Promise<unknown> {
  return authFetch("/email-otp/reset-password", { method: "POST", body: input, auth: false });
}
