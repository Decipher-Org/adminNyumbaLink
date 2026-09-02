import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  ClipboardList,
  Clock,
  CreditCard,
  Flag,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import {
  BarChart,
  DonutChart,
  LineChart,
  RankedBars,
} from "@/components/app/charts";
import { DemoBadge } from "@/components/app/DemoBadge";
import { PageHeader, Panel } from "@/components/app/PageHeader";
import { RangeSelect } from "@/components/app/RangeSelect";
import { StatCard, StatCardSkeleton } from "@/components/app/StatCard";
import { EmptyState, ErrorState, PanelSkeleton } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { fetchPlatformCounts, fetchRevenueSeries } from "@/lib/api/admin";
import { listProperties } from "@/lib/api/properties";
import type { AdminAuditLog, RevenuePoint } from "@/lib/api/types";
import {
  DEMO_DELTAS,
  DEMO_FALLBACK_AREAS,
  demoRegistrationsTrend,
  demoTopAreas,
} from "@/lib/demo/dashboard";
import { useAsync } from "@/lib/hooks/use-async";
import { dateLabel, daysForRange, type RangeKey } from "@/lib/series";
import {
  formatCompact,
  formatKes,
  formatKesCompact,
  formatNumber,
  formatRelative,
} from "@/lib/format";

/**
 * Dashboard Overview.
 *
 * The headline counts are **real** and now include money: `fetchPlatformCounts` reads
 * users, landlords, properties, payments and subscriptions from `GET /admin/dashboard`
 * in one request, falling back to six `limit=1` list calls against an older backend. That
 * fallback cannot produce the money blocks, which is why they are optional on
 * `PlatformCounts` and render as `—` rather than `0` when absent — a zero would read as
 * "nobody has paid".
 *
 * What is still invented is what needs history the platform doesn't keep: the growth
 * percentages, the registrations curve, and the view counts in the areas panel. Each
 * carries its own badge; see `lib/demo/registry.ts`. Administrative activity is real.
 *
 * The property count is worth reading twice: it counts listings at status ACTIVE,
 * so the number is *live listings*, not all listings. The card says "Live
 * properties" rather than "Properties", because a label that overstates what it
 * counts is the kind of thing an operator later makes a decision on.
 */
function formatAuditTitle(log: AdminAuditLog): string {
  switch (log.action) {
    case "USER_ROLE_CHANGE":
      return `Role changed: ${String(log.metadata?.newRole ?? "User")}`;
    case "USER_SUSPEND":
      return "User suspended";
    case "USER_REINSTATE":
      return "User reinstated";
    case "LANDLORD_APPROVE":
      return "Landlord approved";
    case "REPORT_RESOLVE_HIDE":
      return "Listing hidden & report resolved";
    case "REPORT_RESOLVED":
      return "Report resolved";
    case "REPORT_DISMISSED":
      return "Report dismissed";
    case "REPORT_REVIEWING":
      return "Report review started";
    case "JOB_RETRY_REQUESTED":
      return "Background job retry requested";
    case "PAYMENT_RECONCILE_REQUESTED":
      return "Payment reconciliation requested";
    default:
      return log.action.replace(/_/g, " ");
  }
}

function formatAuditDetail(log: AdminAuditLog): string {
  const actor = log.admin?.name || log.admin?.email || "Admin";
  if (log.action === "USER_SUSPEND" && log.metadata?.reason) {
    return `${actor}: ${String(log.metadata.reason)}`;
  }
  if (log.metadata?.notes) {
    return `${actor}: ${String(log.metadata.notes)}`;
  }
  if (log.metadata?.targetEmail) {
    return `By ${actor} on ${String(log.metadata.targetEmail)}`;
  }
  return `By ${actor} on ${log.targetType.toLowerCase()}`;
}

export default function Dashboard() {
  const [range, setRange] = useState<RangeKey>("7d");
  const days = daysForRange(range);

  const { data, error, loading, reload } = useAsync(async (signal) => {
    // Sequential, not `Promise.all`. Against the current backend this is one
    // grouped request followed by one page of properties; against a backend
    // without `/admin/dashboard` the first call becomes six, and running the
    // properties fetch alongside them is what tipped this screen into 500s.
    const counts = await fetchPlatformCounts(signal);
    // The rows are the sample the areas panel groups. `pagination.total` is also
    // the live-listing count on an older backend, where the grouped endpoint that
    // now supplies it is absent.
    const properties = await listProperties({ limit: 100, signal });
    return { counts, properties };
  }, []);

  const counts = data?.counts;
  const properties = data?.properties;
  const payments = counts?.payments;
  const subscriptions = counts?.subscriptions;
  const reports = counts?.reports;
  const recentActivity = counts?.recentActivity;

  /**
   * The dashboard already carries 30 days of revenue, so 7d and 30d are a slice of what
   * has arrived and cost nothing extra. Only 90d needs its own request — which is why
   * this fetcher returns `undefined` for the other two rather than duplicating them.
   */
  const extended = useAsync(
    (signal) =>
      days === 90
        ? fetchRevenueSeries({ days: 90, signal })
        : Promise.resolve(undefined),
    [days],
  );

  const revenuePoints: RevenuePoint[] | undefined =
    days === 90 ? extended.data?.points : payments?.series30d.slice(-days);
  const revenueTotal = revenuePoints?.reduce(
    (sum, point) => sum + point.amount,
    0,
  );

  const registrations = useMemo(() => demoRegistrationsTrend(days), [days]);

  const activity = useMemo(() => {
    return (recentActivity ?? []).map((log) => ({
      id: log.id,
      title: formatAuditTitle(log),
      detail: formatAuditDetail(log),
      at: log.createdAt,
    }));
  }, [recentActivity]);

  const areas = useMemo(() => {
    const grouped = demoTopAreas(properties?.items ?? []);
    return grouped.length > 0 ? grouped : DEMO_FALLBACK_AREAS;
  }, [properties]);
  const areasAreReal = (properties?.items.length ?? 0) > 0;

  const rangeLabel = RANGE_LABELS[range];

  if (error) {
    return (
      <>
        <PageHeader
          title="Dashboard"
          description="Platform health at a glance."
        />
        <ErrorState error={error} onRetry={reload} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live platform counts, revenue and listing terms."
        actions={
          <RangeSelect
            value={range}
            onChange={setRange}
            className="w-full sm:w-44"
          />
        }
      />

      {/* The actionable numbers on the screen get prominent alert rows. */}
      {counts && counts.pendingApprovals > 0 ? (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-body-sm text-warning-strong">
            <p className="font-semibold">
              {formatNumber(counts.pendingApprovals)}{" "}
              {counts.pendingApprovals === 1 ? "landlord is" : "landlords are"}{" "}
              waiting for approval
            </p>
            <p className="mt-0.5 opacity-90">
              They can't publish a listing until someone reviews them.
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0 bg-card">
            <Link to="/landlords">
              Open the queue
              <ArrowRight />
            </Link>
          </Button>
        </div>
      ) : null}

      {reports && reports.open > 0 ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-body-sm text-destructive-strong">
            <p className="font-semibold">
              {formatNumber(reports.open)}{" "}
              {reports.open === 1 ? "listing report is" : "listing reports are"}{" "}
              waiting for review
            </p>
            <p className="mt-0.5 opacity-90">
              Tenants have flagged listings that require operational
              investigation.
            </p>
          </div>
          <Button asChild variant="outline" className="shrink-0 bg-card">
            <Link to="/reports?status=OPEN">
              Open report queue
              <ArrowRight />
            </Link>
          </Button>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading && !counts ? (
          Array.from({ length: 6 }, (_, index) => (
            <StatCardSkeleton key={index} />
          ))
        ) : (
          <>
            <StatCard
              label="Total users"
              value={formatNumber(counts?.totalUsers)}
              icon={Users}
              delta={{
                value: DEMO_DELTAS.totalUsers,
                note: "vs previous period",
                demo: "growthDeltas",
              }}
            />
            <StatCard
              label="Landlords"
              value={formatNumber(counts?.landlords)}
              icon={ShieldCheck}
              delta={{
                value: DEMO_DELTAS.landlords,
                note: "vs previous period",
                demo: "growthDeltas",
              }}
            />
            <StatCard
              label="Live properties"
              value={formatNumber(
                counts?.liveProperties ?? properties?.pagination.total,
              )}
              icon={Building2}
              delta={{
                value: DEMO_DELTAS.properties,
                note: "vs previous period",
                demo: "growthDeltas",
              }}
            />
            <StatCard
              label="Active listing terms"
              value={
                subscriptions ? formatNumber(subscriptions.landlordActive) : "—"
              }
              note="Properties with time left on a term"
              icon={Wallet}
            />
            <StatCard
              label={`Revenue · ${rangeLabel}`}
              value={
                revenueTotal === undefined
                  ? "—"
                  : formatKesCompact(revenueTotal)
              }
              note={
                revenueTotal === undefined
                  ? "Not available"
                  : "Settled M-Pesa payments"
              }
              icon={CreditCard}
            />
            {/*
              The other actionable figure. All-time rather than windowed on purpose — a
              payment stuck at PENDING for three weeks is exactly the one worth chasing.
            */}
            <StatCard
              label="Pending payments"
              value={
                payments ? (
                  payments.pending > 0 ? (
                    <Link
                      to="/payments?status=PENDING"
                      className="hover:underline"
                    >
                      {formatNumber(payments.pending)}
                    </Link>
                  ) : (
                    formatNumber(0)
                  )
                ) : (
                  "—"
                )
              }
              note={
                payments && payments.pending > 0
                  ? "Awaiting confirmation — reconcile to check"
                  : "Nothing awaiting confirmation"
              }
              icon={Clock}
            />
            <StatCard
              label="Open reports"
              value={
                reports ? (
                  reports.open > 0 ? (
                    <Link to="/reports?status=OPEN" className="hover:underline">
                      {formatNumber(reports.open)}
                    </Link>
                  ) : (
                    formatNumber(0)
                  )
                ) : (
                  "—"
                )
              }
              note={
                reports && reports.open > 0
                  ? `${formatNumber(reports.reviewing)} currently under review`
                  : "No unresolved tenant reports"
              }
              icon={Flag}
            />
          </>
        )}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="User registrations"
          description={`Signups per day, ${rangeLabel}`}
          action={<DemoBadge feature="registrationsTrend" />}
          className="lg:col-span-2"
        >
          <LineChart
            points={registrations}
            ariaLabel={`Sample daily user registrations over the ${rangeLabel}`}
          />
        </Panel>

        {/*
          Two slices, not three. There is no cancellation in Milestone 5 — a term either
          has time left or it doesn't — and tenant passes are counted in people rather
          than properties, so they go in the footer rather than sharing this denominator.
        */}
        <Panel
          title="Listing terms"
          description="One 30-day term per property"
          footer={
            subscriptions
              ? `${formatNumber(subscriptions.tenantPassesLive)} tenants also hold a live browsing pass — counted separately, since a pass belongs to a person.`
              : undefined
          }
        >
          {!subscriptions ? (
            <PanelSkeleton />
          ) : (
            <DonutChart
              slices={[
                {
                  key: "active",
                  label: "Active",
                  value: subscriptions.landlordActive,
                  color: "var(--success)",
                },
                {
                  key: "lapsed",
                  label: "Lapsed",
                  value: subscriptions.landlordLapsed,
                  color: "var(--destructive)",
                },
              ]}
              centreLabel="terms"
              className="sm:flex-col lg:flex-col"
            />
          )}
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Revenue trend"
          description={`Money settled, ${rangeLabel}`}
          footer={
            payments
              ? `Totals exclude ${formatKes(payments.failed7d)} of failed payments in the last 7 days.`
              : undefined
          }
          className="lg:col-span-2"
        >
          {extended.error ? (
            <ErrorState error={extended.error} onRetry={extended.reload} />
          ) : !revenuePoints ? (
            <PanelSkeleton />
          ) : (
            <BarChart
              points={revenuePoints.map((point) => ({
                label: dateLabel(point.date, days),
                value: point.amount,
              }))}
              valuePrefix="KSh "
              ariaLabel={`Money settled per day over the ${rangeLabel}`}
            />
          )}
        </Panel>

        <Panel
          title="Recent activity"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link to="/audit-logs">View all</Link>
            </Button>
          }
        >
          {activity.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title="No administrative activity yet"
              body="Completed admin actions will appear here."
            />
          ) : (
            <ol className="space-y-4">
              {activity.map((item) => (
                <li key={item.id} className="flex gap-3">
                  <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />
                  <div className="min-w-0">
                    <p className="text-body-sm font-medium text-foreground">{item.title}</p>
                    <p className="text-caption text-muted-foreground">{item.detail}</p>
                    <p className="mt-0.5 text-caption text-muted-foreground/80">{formatRelative(item.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Panel>
      </div>

      <div className="mt-4">
        {loading && !properties ? (
          <PanelSkeleton />
        ) : (
          <Panel
            title="Top areas"
            description={
              areasAreReal
                ? "Grouped from live listings. View counts are samples."
                : "No live listings to group yet — showing sample areas."
            }
            action={<DemoBadge feature="views" />}
            footer={
              areasAreReal
                ? `Listing counts cover the ${formatNumber(properties?.items.length)} most recent live listings, not the full catalogue.`
                : undefined
            }
          >
            <RankedBars
              rows={areas.map((area) => ({
                key: `${area.area}-${area.county}`,
                label: area.area,
                caption: area.county,
                value: area.views,
                valueLabel: `${formatCompact(area.views)} views · ${formatNumber(area.listings)} listings`,
              }))}
            />
          </Panel>
        )}
      </div>
    </>
  );
}

const RANGE_LABELS: Record<RangeKey, string> = {
  "7d": "last 7 days",
  "30d": "last 30 days",
  "90d": "last 90 days",
};
