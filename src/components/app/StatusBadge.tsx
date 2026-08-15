import type { ReactNode } from "react";

import type { PropertyStatus, Role, UserStatus } from "@/lib/api/types";
import type { PaymentStatus, SubscriptionStatus } from "@/lib/demo/finance";
import type { DocumentStatus, ReportStatus } from "@/lib/demo/ops";
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

type Tone = "success" | "warning" | "destructive" | "inactive" | "info" | "muted" | "primary";

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
  const entry = USER_STATUS_MAP[status] ?? { tone: "muted" as Tone, label: status };
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

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
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
const PROPERTY_STATUS_MAP: Record<PropertyStatus, { tone: Tone; label: string }> = {
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

const PAYMENT_STATUS_MAP: Record<PaymentStatus, { tone: Tone; label: string }> = {
  SUCCESS: { tone: "success", label: "Successful" },
  PENDING: { tone: "warning", label: "Pending" },
  FAILED: { tone: "destructive", label: "Failed" },
};

export function PaymentStatusBadge({
  status,
  className,
}: {
  status: PaymentStatus;
  className?: string;
}) {
  const entry = PAYMENT_STATUS_MAP[status];
  return (
    <Pill tone={entry.tone} className={className}>
      {entry.label}
    </Pill>
  );
}

const SUBSCRIPTION_STATUS_MAP: Record<SubscriptionStatus, { tone: Tone; label: string }> = {
  ACTIVE: { tone: "success", label: "Active" },
  EXPIRED: { tone: "destructive", label: "Expired" },
  CANCELLED: { tone: "inactive", label: "Cancelled" },
};

export function SubscriptionStatusBadge({
  status,
  className,
}: {
  status: SubscriptionStatus;
  className?: string;
}) {
  const entry = SUBSCRIPTION_STATUS_MAP[status];
  return (
    <Pill tone={entry.tone} className={className}>
      {entry.label}
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

const DOCUMENT_STATUS_MAP: Record<DocumentStatus, { tone: Tone; label: string }> = {
  RECEIVED: { tone: "success", label: "Received" },
  MISSING: { tone: "destructive", label: "Missing" },
  UNREADABLE: { tone: "warning", label: "Unreadable" },
};

export function DocumentStatusBadge({
  status,
  className,
}: {
  status: DocumentStatus;
  className?: string;
}) {
  const entry = DOCUMENT_STATUS_MAP[status];
  return (
    <Pill tone={entry.tone} className={className}>
      {entry.label}
    </Pill>
  );
}

/**
 * "2 of 3" document progress. Complete is green, anything short is amber — an
 * incomplete set is the queue's whole reason for existing, so it has to read as
 * needing attention rather than as a neutral count.
 */
export function DocumentCount({
  received,
  required,
  className,
}: {
  received: number;
  required: number;
  className?: string;
}) {
  return (
    <Pill tone={received >= required ? "success" : "warning"} className={className}>
      {received}/{required}
    </Pill>
  );
}
