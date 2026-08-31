import { useEffect, useState } from "react";
import {
  AlertCircle,
  Banknote,
  Bell,
  BellOff,
  Building2,
  Check,
  CheckCheck,
  CreditCard,
  Eye,
  Home,
  Info,
  Loader2,
  ShieldAlert,
  Sparkles,
  Star,
  TriangleAlert,
  UserCheck,
  XCircle,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/app/States";
import { Pill } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import * as notificationsApi from "@/lib/api/notifications";
import type { NotificationType } from "@/lib/api/types";
import { useAsync } from "@/lib/hooks/use-async";
import { useNotifications } from "@/lib/notifications/NotificationProvider";
import { formatDateTime, formatRelative } from "@/lib/format";
import {
  currentPushState,
  enablePushNotifications,
  type PushState,
} from "@/lib/notifications/push";
import { cn } from "@/lib/utils";

/**
 * Notifications Console.
 *
 * Milestone 7 — Live notifications from the backend API.
 * Supports server-side unread filtering, pagination, live read mutations,
 * and browser push notification token registration.
 */

type IconConfig = { label: string; icon: LucideIcon; className: string };

/**
 * Presentation for every type the backend can write. Exhaustive over
 * `NotificationType` on purpose — a type with no entry here used to fall back to the
 * generic "System Alert" chrome, which is how `PROPERTY_REVIEWED` quietly rendered as
 * something it wasn't.
 */
const KIND_META: Record<NotificationType, IconConfig> = {
  ADMIN_LANDLORD_PENDING: {
    label: "Verification",
    icon: UserCheck,
    className: "bg-warning-soft text-warning-strong",
  },
  ADMIN_PAYMENT_RECEIVED: {
    label: "Revenue",
    icon: Banknote,
    className: "bg-success-soft text-success-strong",
  },
  ADMIN_PAYMENT_FAILED: {
    label: "Failed Payment",
    icon: XCircle,
    className: "bg-destructive-soft text-destructive-strong",
  },
  ADMIN_DUPLICATE_RECEIPT: {
    label: "Duplicate Receipt",
    icon: TriangleAlert,
    className: "bg-destructive-soft text-destructive-strong",
  },
  ADMIN_PROPERTY_PUBLISHED: {
    label: "New Listing",
    icon: Building2,
    className: "bg-info-soft text-info-strong",
  },
  PAYMENT_SUCCESS: {
    label: "Payment",
    icon: CreditCard,
    className: "bg-success-soft text-success-strong",
  },
  SUBSCRIPTION_EXPIRING: {
    label: "Subscription",
    icon: ShieldAlert,
    className: "bg-warning-soft text-warning-strong",
  },
  PROPERTY_HIDDEN: {
    label: "Listing Hidden",
    icon: Home,
    className: "bg-destructive-soft text-destructive-strong",
  },
  PROPERTY_VIEWED: {
    label: "Listing Viewed",
    icon: Eye,
    className: "bg-info-soft text-info-strong",
  },
  PROPERTY_REVIEWED: {
    label: "Review",
    icon: Star,
    className: "bg-info-soft text-info-strong",
  },
  NEW_MATCHING_PROPERTY: {
    label: "New Match",
    icon: Sparkles,
    className: "bg-info-soft text-info-strong",
  },
  SYSTEM_ALERT: {
    label: "System Alert",
    icon: Info,
    className: "bg-secondary text-primary",
  },
};

/**
 * Which types get their own filter tab. Twelve tabs would scroll off the header, and the
 * landlord/tenant types are near-empty on an admin account — they stay reachable through
 * "All". Ordered by how often an operator reaches for them.
 */
const FILTER_KINDS: NotificationType[] = [
  "ADMIN_LANDLORD_PENDING",
  "ADMIN_PAYMENT_FAILED",
  "ADMIN_DUPLICATE_RECEIPT",
  "ADMIN_PAYMENT_RECEIVED",
  "ADMIN_PROPERTY_PUBLISHED",
  "SYSTEM_ALERT",
];

type Filter = "all" | "unread" | NotificationType;

export default function Notifications() {
  const { unreadCount, refreshUnreadCount } = useNotifications();
  const [filter, setFilter] = useState<Filter>("all");
  const [page, setPage] = useState(1);
  const limit = 20;

  // Push notification state
  const [pushState, setPushState] = useState<PushState>("unsupported");
  const [pushLoading, setPushLoading] = useState(false);
  const [pushError, setPushError] = useState<string | null>(null);

  useEffect(() => {
    setPushState(currentPushState());
  }, []);

  // Fetch notifications with server-side unreadOnly, type and pagination
  const { data, error, loading, reload, setData } = useAsync(
    (signal) =>
      notificationsApi.listNotifications(
        {
          unreadOnly: filter === "unread",
          type: filter === "all" || filter === "unread" ? undefined : filter,
          page,
          limit,
        },
        signal,
      ),
    [filter, page],
  );

  const items = data?.items ?? [];
  const pagination = data?.pagination;

  async function handleEnablePush() {
    setPushLoading(true);
    setPushError(null);
    try {
      await enablePushNotifications();
      setPushState(currentPushState());
    } catch (err) {
      setPushError(
        err instanceof Error ? err.message : "Failed to enable browser alerts.",
      );
      setPushState(currentPushState());
    } finally {
      setPushLoading(false);
    }
  }

  async function handleMarkAsRead(id: string) {
    try {
      const updated = await notificationsApi.markAsRead(id);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((n) => (n.id === updated.id ? updated : n)),
        };
      });
      refreshUnreadCount();
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
      reload();
    }
  }

  async function handleMarkAllAsRead() {
    try {
      await notificationsApi.markAllAsRead();
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((n) => ({
            ...n,
            isRead: true,
            readAt: n.readAt ?? new Date().toISOString(),
          })),
        };
      });
      refreshUnreadCount();
    } catch (err) {
      console.error("Failed to mark all notifications as read:", err);
      reload();
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread notification${unreadCount === 1 ? "" : "s"}.`
            : "You're all caught up."
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {pushState === "enabled" ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-success/30 bg-success-soft px-3 py-1.5 text-caption font-medium text-success-strong">
                <Check className="size-4" />
                Browser alerts active
              </span>
            ) : pushState === "default" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleEnablePush}
                disabled={pushLoading}
              >
                {pushLoading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Bell className="size-4" />
                )}
                Enable browser alerts
              </Button>
            ) : pushState === "denied" ? (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive-soft px-3 py-1.5 text-caption text-destructive-strong">
                <AlertCircle className="size-4 shrink-0" />
                Alerts blocked in browser
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-3 py-1.5 text-caption text-muted-foreground">
                <AlertCircle className="size-4 shrink-0" />
                {pushState === "unconfigured"
                  ? "Browser alerts are not configured for this environment"
                  : "This browser does not support push alerts"}
              </span>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={unreadCount === 0 || loading}
            >
              <CheckCheck className="size-4" />
              Mark all read
            </Button>
          </div>
        }
      />

      {pushError && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive-soft p-3 text-body-sm text-destructive-strong">
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p>{pushError}</p>
        </div>
      )}

      {/* Filter Tabs */}
      <Tabs
        value={filter}
        onValueChange={(value) => {
          setFilter(value as Filter);
          setPage(1);
        }}
        className="mt-6"
      >
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unreadCount > 0 ? (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] leading-4 font-semibold text-primary-foreground">
                  {unreadCount}
                </span>
              ) : null}
            </TabsTrigger>
            {FILTER_KINDS.map((kind) => (
              <TabsTrigger key={kind} value={kind}>
                {KIND_META[kind].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      {/* Main Content Area */}
      {loading && !data ? (
        <div className="mt-4 rounded-xl border border-border bg-card">
          <TableSkeleton rows={4} columns={2} />
        </div>
      ) : error ? (
        <ErrorState error={error} onRetry={reload} className="mt-4" />
      ) : items.length === 0 ? (
        <div className="mt-4">
          <EmptyState
            icon={BellOff}
            title="Nothing here"
            body={
              filter === "unread"
                ? "You have no unread notifications."
                : filter === "all"
                  ? "No platform notifications recorded yet."
                  : `No ${KIND_META[filter as NotificationType]?.label.toLowerCase() ?? ""} notifications recorded.`
            }
          />
        </div>
      ) : (
        <div className="mt-4 rounded-xl border border-border bg-card">
          <ul className="divide-y divide-border">
            {items.map((notification) => {
              const meta =
                KIND_META[notification.type] ?? KIND_META.SYSTEM_ALERT;
              const Icon = meta.icon;

              return (
                <li
                  key={notification.id}
                  className={cn(
                    "flex gap-3 p-4 transition-colors",
                    !notification.isRead ? "bg-primary/[0.035]" : undefined,
                  )}
                >
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full",
                      meta.className,
                    )}
                  >
                    <Icon aria-hidden="true" className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                      <p
                        className={cn(
                          "text-body-sm text-foreground",
                          !notification.isRead ? "font-semibold" : undefined,
                        )}
                      >
                        {notification.title}
                      </p>
                      {!notification.isRead && <Pill tone="primary">New</Pill>}
                    </div>

                    <p className="mt-0.5 text-body-sm text-muted-foreground">
                      {notification.body}
                    </p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <time
                        dateTime={notification.createdAt}
                        className="text-caption text-muted-foreground"
                        title={formatDateTime(notification.createdAt)}
                      >
                        {formatRelative(notification.createdAt)}
                      </time>

                      {!notification.isRead && (
                        <button
                          type="button"
                          onClick={() => handleMarkAsRead(notification.id)}
                          className="text-caption font-medium text-primary underline-offset-2 hover:underline"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {/* Backend-driven Pagination Controls */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-border px-4 py-3 sm:px-6">
              <div className="text-caption text-muted-foreground">
                Showing page{" "}
                <span className="font-medium text-foreground">
                  {pagination.page}
                </span>{" "}
                of{" "}
                <span className="font-medium text-foreground">
                  {pagination.totalPages}
                </span>{" "}
                ({pagination.total} total)
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Info Band */}
      <div className="mt-6 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-body font-semibold text-foreground">
          <Bell aria-hidden="true" className="size-4" />
          What lands here
        </h2>
        <p className="mt-1.5 text-body-sm text-muted-foreground">
          Every administrator is notified when a landlord submits a profile for
          verification, when a payment settles or fails, when a duplicate M-Pesa receipt
          is rejected, and when a listing is published. Verification, failed payments and
          duplicate receipts also arrive as browser alerts; revenue and new listings are
          in-app only, because they are a running commentary rather than something to
          act on.
        </p>
        <p className="mt-1.5 text-body-sm text-muted-foreground">
          With browser alerts enabled, an arriving notification updates this console
          immediately. Otherwise the unread count refreshes once a minute.
        </p>
      </div>
    </>
  );
}
