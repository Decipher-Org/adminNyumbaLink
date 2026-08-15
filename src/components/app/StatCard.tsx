import type { ComponentType, ReactNode } from "react";
import { TrendingDown, TrendingUp } from "lucide-react";

import { DemoBadge } from "@/components/app/DemoBadge";
import type { DemoFeatureId } from "@/lib/demo/registry";
import { formatDelta } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * A dashboard stat tile: label, icon, value, and an optional period-over-period
 * delta beneath.
 *
 * The value uses the font's proportional figures deliberately — `tabular-nums`
 * gives every digit the width of a zero, which makes a number like `121` look
 * gappy at this size. Tabular figures are for columns that must align vertically,
 * which is the table's job, not this one's.
 *
 * The badge placement is the point of this component. On this dashboard the count
 * is usually **real** (from `pagination.total`) while the percentage beside it is
 * **not** (no endpoint reports a previous period). Marking the whole tile as demo
 * would understate the count; marking nothing would overstate the delta. So `demo`
 * flags the value and `delta.demo` flags only the percentage, and a tile can use
 * either, both, or neither.
 */
export function StatCard({
  label,
  value,
  note,
  icon: Icon,
  demo,
  delta,
  className,
}: {
  label: string;
  value: ReactNode;
  note?: string;
  icon?: ComponentType<{ className?: string }>;
  /** Marks the *value* as sample data. */
  demo?: DemoFeatureId;
  delta?: {
    /** Percent change. Negative renders as a fall, in the destructive tone. */
    value: number;
    /** e.g. "vs previous 7 days". */
    note?: string;
    /** Marks only the percentage as sample data. */
    demo?: DemoFeatureId;
  };
  className?: string;
}) {
  const rising = (delta?.value ?? 0) >= 0;

  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-body-sm text-muted-foreground">{label}</p>
        {Icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-primary">
            <Icon className="size-4.5" />
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <p className="text-[26px] leading-tight font-semibold text-foreground sm:text-[28px]">
          {value}
        </p>
        {demo ? <DemoBadge feature={demo} /> : null}
      </div>

      {delta ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-caption font-semibold",
              rising ? "bg-success-soft text-success-strong" : "bg-destructive-soft text-destructive-strong",
            )}
          >
            {rising ? (
              <TrendingUp aria-hidden="true" className="size-3" />
            ) : (
              <TrendingDown aria-hidden="true" className="size-3" />
            )}
            {formatDelta(delta.value)}
          </span>
          {delta.note ? (
            <span className="text-caption text-muted-foreground">{delta.note}</span>
          ) : null}
          {delta.demo ? <DemoBadge feature={delta.demo} /> : null}
        </div>
      ) : note ? (
        <p className="mt-2 text-caption text-muted-foreground">{note}</p>
      ) : null}
    </div>
  );
}

/** Placeholder with the same footprint, so the grid doesn't jump on load. */
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className="h-4 w-24 animate-pulse rounded bg-muted" />
        <div className="size-9 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="mt-3 h-7 w-20 animate-pulse rounded bg-muted" />
      <div className="mt-3 h-4 w-28 animate-pulse rounded bg-muted" />
    </div>
  );
}
