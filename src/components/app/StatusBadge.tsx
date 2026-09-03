import type { ReactNode } from "react";

import type {
  PaymentStatus,
  PropertyStatus,
  ReportStatus,
  Role,
  UserStatus,
} from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * Status pills, built on the design system's status triads (soft background +
 * strong text) so every badge clears WCAG AA — which a solid fill on white does
 * not.
 *
 * One `Pill` with named tones rather than a `Badge` variant per domain: this
 * console shows six unrelated status vocabularies (account, approval, property,
 * payment, subscription, report) and they must agree on what green means. The
 * legend in the sidebar footer is the contract — active is green, inactive grey,
 * pending amber, suspended red — and every mapping below honours it.
 */

type Tone =
  | "success"
  | "warning"
  | "destructive"
  | "inactive"
  | "info"
  | "muted"
  | "primary";

const TONE_CLASSES: Record<Tone, string> = {
  success: "bg-success-soft text-success-strong",
  warning: "bg-warning-soft text-warning-strong",
  destructive: "bg-destructive-soft text-destructive-strong",
  inactive: "bg-inactive-soft text-inactive-strong",
  info: "bg-info-soft text-info-strong",
  muted: "bg-muted text-muted-foreground",
  primary: "bg-secondary text-primary",
};

export function Pill({
  tone,
  children,
  className,
}: {
  tone: Tone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-caption font-semibold whitespace-nowrap",
        TONE_CLASSES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

// ------------------------------------------------------------------ accounts

/**
 * `DEACTIVATED` is styled `inactive`, not destructive: the user closed their own
 * account. Nothing went wrong and no admin acted, so red would misattribute it —
 * and an admin cannot reverse it, unlike a suspension.
 */
const USER_STATUS_MAP: Record<UserStatus, { tone: Tone; label: string }> = {
  ACTIVE: { tone: "success", label: "Active" },
  SUSPENDED: { tone: "destructive", label: "Suspended" },
  DEACTIVATED: { tone: "inactive", label: "Deactivated" },
};

export function UserStatusBadge({
  status,
  className,
}: {
  status: UserStatus;
  className?: string;
}) {
  const entry = USER_STATUS_MAP[status] ?? {
    tone: "muted" as Tone,
    label: status,
  };
  return (
    <Pill tone={entry.tone} className={className}>
      {entry.label}
    </Pill>
  );
}

const ROLE_MAP: Record<Role, { tone: Tone; label: string }> = {
  ADMIN: { tone: "primary", label: "Admin" },
  LANDLORD: { tone: "info", label: "Landlord" },
  TENANT: { tone: "muted", label: "Tenant" },
};

export function RoleBadge({
  role,
  className,
}: {
  role: Role;
  className?: string;
}) {
  const entry = ROLE_MAP[role] ?? { tone: "muted" as Tone, label: role };
  return (
    <Pill tone={entry.tone} className={className}>
      {entry.label}
    </Pill>
  );
}

/**
 * Landlord approval. This is `verified` on the profile, and it is deliberately
 * worded as "Pending" rather than "Unverified": the landlord has done their part
 * and is waiting on an admin, which is a queue state, not a fault.
 */
export function ApprovalBadge({
  verified,
  className,
}: {
  verified: boolean;
  className?: string;
}) {
  return (
    <Pill tone={verified ? "success" : "warning"} className={className}>
      {verified ? "Approved" : "Pending"}
    </Pill>
  );
}

// ---------------------------------------------------------------- properties

/**
 * `ARCHIVED` uses muted rather than destructive red: archiving is a normal
 * end-of-life move, not an error.
 */
const PROPERTY_STATUS_MAP: Record<
  PropertyStatus,
  { tone: Tone; label: string }
> = {
  ACTIVE: { tone: "success", label: "Active" },
  DRAFT: { tone: "warning", label: "Draft" },
  HIDDEN: { tone: "inactive", label: "Hidden" },
  ARCHIVED: { tone: "muted", label: "Archived" },
};

export function PropertyStatusBadge({
  status,
  className,
}: {
  status: PropertyStatus;
  className?: string;
}) {
  const entry = PROPERTY_STATUS_MAP[status] ?? PROPERTY_STATUS_MAP.DRAFT;
  return (
    <Pill tone={entry.tone} className={className}>
      {entry.label}
    </Pill>
  );
}

// ------------------------------------------------------------------- money

/**
 * All five backend statuses.
 *
 * `PENDING` and `QUEUED` are both amber because both are non-terminal — the payer is
 * looking at a prompt, or M-Pesa has it and hasn't said what happened. They are kept
 * distinct rather than collapsed into one "Pending" because they fail differently:
 * a row stuck at `QUEUED` reached the gateway and is a reconcile away from an answer,
 * while one stuck at `PENDING` may never have got that far.
 *
 * `CANCELLED` is `inactive`, not destructive: the payer changed their mind at the PIN
 * prompt. Nothing broke, so red would misattribute it — the same reasoning as
 * `DEACTIVATED` above.
 */
const PAYMENT_STATUS_MAP: Record<PaymentStatus, { tone: Tone; label: string }> =
  {
    PENDING: { tone: "warning", label: "Pending" },
    QUEUED: { tone: "warning", label: "Queued" },
    SUCCESS: { tone: "success", label: "Successful" },
    FAILED: { tone: "destructive", label: "Failed" },
    CANCELLED: { tone: "inactive", label: "Cancelled" },
  };

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const entry = PAYMENT_STATUS_MAP[status] ?? {
    tone: "muted" as Tone,
    label: status,
  };
  return (
    <Pill tone={entry.tone} className={className}>
      {entry.label}
    </Pill>
  );
}

/**
 * A landlord term takes a boolean, not a status string.
 *
 * There is no `EXPIRED` or `CANCELLED` column to read: a term is a 30-day block on one
 * property, and the backend derives `active` as `expiresAt > now`. Nothing cancels one
 * early, so the only question is whether it still has time left.
 *
 * "Lapsed" rather than "Expired" because the term is renewable and usually renewed —
 * and `destructive` rather than `inactive` because a lapsed term is the renewal queue's
 * whole reason for existing, so it has to read as needing attention.
 */
export function SubscriptionStatusBadge({
  active,
  className,
}: {
  active: boolean;
  className?: string;
}) {
  return (
    <Pill tone={active ? "success" : "destructive"} className={className}>
      {active ? "Active" : "Lapsed"}
    </Pill>
  );
}

// ---------------------------------------------------------------- moderation

const REPORT_STATUS_MAP: Record<ReportStatus, { tone: Tone; label: string }> = {
  OPEN: { tone: "destructive", label: "Open" },
  REVIEWING: { tone: "warning", label: "Reviewing" },
  RESOLVED: { tone: "success", label: "Resolved" },
  DISMISSED: { tone: "muted", label: "Dismissed" },
};

export function ReportStatusBadge({
  status,
  className,
}: {
  status: ReportStatus;
  className?: string;
}) {
  const entry = REPORT_STATUS_MAP[status];
  return (
    <Pill tone={entry.tone} className={className}>
      {entry.label}
    </Pill>
  );
}
