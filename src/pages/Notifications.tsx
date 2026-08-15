import { useMemo, useState } from "react";
import {
  Bell,
  BellOff,
  CheckCheck,
  CircleDollarSign,
  Flag,
  Server,
  UserCheck,
  UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { DemoBadge, DemoNotice } from "@/components/app/DemoBadge";
import { PageHeader } from "@/components/app/PageHeader";
import { EmptyState } from "@/components/app/States";
import { Pill } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  demoNotifications,
  type DemoNotification,
  type NotificationKind,
} from "@/lib/demo/ops";
import { formatDateTime, formatRelative } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Notifications.
 *
 * Milestone 7. There is no notification table, no email or SMS queue, and nothing
 * that would generate one of these — so the list is sample data, and marking
 * something read only changes this screen.
 *
 * The sidebar badge counts unread items from the same source, so it starts at eight
 * and agrees with the list. It will not move when you read something here: the two
 * read the same module but there is no store between them, and inventing one would
 * only make the fake state feel more real than it is.
 */

const KIND_META: Record<NotificationKind, { label: string; icon: LucideIcon; className: string }> = {
  approval: { label: "Approvals", icon: UserCheck, className: "bg-primary/10 text-primary" },
  report: { label: "Reports", icon: Flag, className: "bg-destructive-soft text-destructive-strong" },
  payment: {
    label: "Payments",
    icon: CircleDollarSign,
    className: "bg-success-soft text-success-strong",
  },
  system: { label: "System", icon: Server, className: "bg-info-soft text-info-strong" },
  user: { label: "Users", icon: UserCog, className: "bg-warning-soft text-warning-strong" },
};

type Filter = "all" | "unread" | NotificationKind;

export default function Notifications() {
  const [items, setItems] = useState<DemoNotification[]>(() => demoNotifications());
  const [filter, setFilter] = useState<Filter>("all");

  const unread = items.filter((item) => !item.read).length;

  const visible = useMemo(() => {
    if (filter === "all") return items;
    if (filter === "unread") return items.filter((item) => !item.read);
    return items.filter((item) => item.kind === filter);
  }, [items, filter]);

  function toggleRead(id: string) {
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, read: !item.read } : item)),
    );
  }

  function markAllRead() {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description={
          unread > 0 ? `${unread} unread of ${items.length}` : `All ${items.length} read`
        }
        actions={
          <Button variant="outline" onClick={markAllRead} disabled={unread === 0}>
            <CheckCheck />
            Mark all read
            <DemoBadge feature="notifications" showLabel={false} />
          </Button>
        }
      />

      <DemoNotice feature="notifications" className="mb-4" />

      {/* Seven filters never fit on a phone, so the row scrolls rather than wraps. */}
      <Tabs value={filter} onValueChange={(value) => setFilter(value as Filter)}>
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="unread">
              Unread
              {unread > 0 ? (
                <span className="ml-1.5 rounded-full bg-primary px-1.5 text-[11px] leading-4 font-semibold text-primary-foreground">
                  {unread}
                </span>
              ) : null}
            </TabsTrigger>
            {(Object.keys(KIND_META) as NotificationKind[]).map((kind) => (
              <TabsTrigger key={kind} value={kind}>
                {KIND_META[kind].label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
      </Tabs>

      <div className="mt-4 rounded-xl border border-border bg-card">
        {visible.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={BellOff}
              title="Nothing here"
              body={
                filter === "unread"
                  ? "Every notification in the sample set has been read."
                  : "No sample notifications of this type."
              }
            />
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {visible.map((notification) => {
              const meta = KIND_META[notification.kind];
              const Icon = meta.icon;

              return (
                <li
                  key={notification.id}
                  className={cn(
                    "flex gap-3 p-4",
                    notification.read ? undefined : "bg-primary/[0.035]",
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
                          notification.read ? undefined : "font-semibold",
                        )}
                      >
                        {notification.title}
                      </p>
                      {notification.read ? null : <Pill tone="primary">New</Pill>}
                    </div>

                    <p className="mt-0.5 text-body-sm text-muted-foreground">{notification.body}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                      <time
                        dateTime={notification.at}
                        className="text-caption text-muted-foreground"
                        title={formatDateTime(notification.at)}
                      >
                        {formatRelative(notification.at)}
                      </time>
                      <button
                        type="button"
                        onClick={() => toggleRead(notification.id)}
                        className="text-caption font-medium text-primary underline-offset-2 hover:underline"
                      >
                        {notification.read ? "Mark unread" : "Mark read"}
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-border bg-surface p-4">
        <h2 className="flex items-center gap-2 text-body font-semibold text-foreground">
          <Bell aria-hidden="true" className="size-4" />
          What Milestone 7 adds
        </h2>
        <p className="mt-1.5 text-body-sm text-muted-foreground">
          A notifications table with a read flag, plus the transactional email path (Resend is
          already configured server-side for verification mail) and an SMS path for approval
          decisions. Until then nothing on this screen is generated by an event, and read state lives
          only in this tab.
        </p>
      </div>
    </>
  );
}
