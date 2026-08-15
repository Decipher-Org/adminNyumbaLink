import { AlertCircle } from "lucide-react";

import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * Inline form error.
 *
 * The backend's own message is shown wherever it has one — its wording is
 * user-facing and specific ("Awaiting admin approval", "Email already
 * registered"), which beats a generic replacement. A few codes are rewritten,
 * because their raw text would leave an operator stuck or would understate what
 * just happened.
 */
export function FormError({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;

  const message = messageFor(error);
  const details = error instanceof ApiError ? fieldMessages(error.details) : [];

  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-2.5 rounded-lg border border-destructive/25 bg-destructive-soft px-3 py-2.5 text-body-sm text-destructive-strong",
        className,
      )}
    >
      <AlertCircle aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <p>{message}</p>
        {details.length > 0 ? (
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {details.map((detail) => (
              <li key={detail}>{detail}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}

function messageFor(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error && error.message
      ? error.message
      : "Something went wrong. Please try again.";
  }

  // Better Auth answers 403 with a terse "Email not verified". An admin account is
  // provisioned server-side and normally arrives verified, so this is the "someone
  // promoted a fresh signup" case and needs to say what to do about it.
  if (
    error.code === "EMAIL_NOT_VERIFIED" ||
    (error.status === 403 && /verif/i.test(error.message))
  ) {
    return "This email isn't verified yet. Verify it in the main NyumbaLink app first, then sign in here.";
  }

  if (error.code === "INSUFFICIENT_PERMISSIONS") {
    return "Your account no longer has administrator access. Another admin may have changed your role.";
  }

  if (error.code === "VALIDATION_ERROR" && error.details.length > 0) {
    return "Please fix the following:";
  }

  if (error.code === "RATE_LIMITED") {
    return "Too many requests. Wait a minute and try again.";
  }

  return error.message;
}

/**
 * The backend's `error.details` is an array of validation entries. Its exact
 * shape varies by validator, so this reads the fields it knows and skips anything
 * it cannot render rather than printing `[object Object]`.
 */
function fieldMessages(details: unknown[]): string[] {
  return details
    .map((detail) => {
      if (typeof detail === "string") return detail;
      if (typeof detail !== "object" || detail === null) return null;

      const record = detail as Record<string, unknown>;
      const field = typeof record.field === "string" ? record.field : undefined;
      const message = typeof record.message === "string" ? record.message : undefined;

      if (field && message) return `${field}: ${message}`;
      return message ?? null;
    })
    .filter((value): value is string => Boolean(value));
}
