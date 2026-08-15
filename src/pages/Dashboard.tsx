import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  CreditCard,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";

import { BarChart, DonutChart, LineChart, RankedBars } from "@/components/app/charts";
import { DemoBadge } from "@/components/app/DemoBadge";
import { PageHeader, Panel } from "@/components/app/PageHeader";
import { RangeSelect } from "@/components/app/RangeSelect";
import { StatCard, StatCardSkeleton } from "@/components/app/StatCard";
import { ErrorState, PanelSkeleton } from "@/components/app/States";
import { Button } from "@/components/ui/button";
import { fetchPlatformCounts } from "@/lib/api/admin";
import { listProperties } from "@/lib/api/properties";
import {
  DEMO_ACTIVE_SUBSCRIPTIONS,
  DEMO_DELTAS,
  DEMO_FALLBACK_AREAS,
  DEMO_SUBSCRIPTION_MIX,
  daysForRange,
  demoActivity,
  demoRegistrationsTrend,
  demoRevenueTotal,
  demoRevenueTrend,
  demoTopAreas,
  type RangeKey,
} from "@/lib/demo/dashboard";
import { useAsync } from "@/lib/hooks/use-async";
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
 * The five headline counts are **real**: `fetchPlatformCounts` reads them from
 * `GET /admin/dashboard` in one request, falling back to six `limit=1` list calls
 * against an older backend. What is invented is everything that needs history or
 * money — the growth percentages, the two trend charts, the subscription mix, the
 * activity feed, and the view counts in the areas panel. Each of those carries its
 * own badge; see `lib/demo/registry.ts`.
 *
 * The property count is worth reading twice: it counts listings at status ACTIVE,
 * so the number is *live listings*, not all listings. The card says "Live
 * properties" rather than "Properties", because a label that overstates what it
 * counts is the kind of thing an operator later makes a decision on.
 */
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

  const registrations = useMemo(() => demoRegistrationsTrend(days), [days]);
  const revenueTrend = useMemo(() => demoRevenueTrend(days), [days]);
  const revenueTotal = demoRevenueTotal(days);
  const activity = useMemo(() => demoActivity(), []);

  const areas = useMemo(() => {
    const grouped = demoTopAreas(properties?.items ?? []);
    return grouped.length > 0 ? grouped : DEMO_FALLBACK_AREAS;
  }, [properties]);
  const areasAreReal = (properties?.items.length ?? 0) > 0;

  const rangeLabel = RANGE_LABELS[range];

  if (error) {
    return (
      <>
        <PageHeader title="Dashboard" description="Platform health at a glance." />
        <ErrorState error={error} onRetry={reload} />
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Live platform counts, with trends and revenue as previews."
        actions={<RangeSelect value={range} onChange={setRange} className="w-full sm:w-44" />}
      />

      {/* The one genuinely actionable number on the screen gets a row of its own. */}
      {counts && counts.pendingApprovals > 0 ? (
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-body-sm text-warning-strong">
            <p className="font-semibold">
              {formatNumber(counts.pendingApprovals)}{" "}
              {counts.pendingApprovals === 1 ? "landlord is" : "landlords are"} waiting for approval
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {loading && !counts ? (
          Array.from({ length: 5 }, (_, index) => <StatCardSkeleton key={index} />)
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
              value={formatNumber(counts?.liveProperties ?? properties?.pagination.total)}
              icon={Building2}
              delta={{
                value: DEMO_DELTAS.properties,
                note: "vs previous period",
                demo: "growthDeltas",
              }}
            />
            <StatCard
              label="Active subscriptions"
              value={formatNumber(DEMO_ACTIVE_SUBSCRIPTIONS)}
              icon={Wallet}
              demo="subscriptions"
              delta={{
                value: DEMO_DELTAS.subscriptions,
                note: "vs previous period",
                demo: "subscriptions",
              }}
            />
            <StatCard
              label={`Revenue · ${rangeLabel}`}
              value={formatKesCompact(revenueTotal)}
              icon={CreditCard}
              demo="revenue"
              delta={{ value: DEMO_DELTAS.revenue, note: "vs previous period", demo: "revenue" }}
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

        <Panel title="Subscription status" action={<DemoBadge feature="subscriptions" />}>
          <DonutChart
            slices={[
              {
                key: "active",
                label: "Active",
                value: DEMO_SUBSCRIPTION_MIX[0].count,
                color: "var(--success)",
              },
              {
                key: "expired",
                label: "Expired",
                value: DEMO_SUBSCRIPTION_MIX[1].count,
                color: "var(--destructive)",
              },
              {
                key: "cancelled",
                label: "Cancelled",
                value: DEMO_SUBSCRIPTION_MIX[2].count,
                color: "var(--inactive)",
              },
            ]}
            centreLabel="subscriptions"
            className="sm:flex-col lg:flex-col"
          />
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Revenue trend"
          description={`${formatKes(revenueTotal)} · ${rangeLabel}`}
          action={<DemoBadge feature="revenue" />}
          className="lg:col-span-2"
        >
          <BarChart
            points={revenueTrend}
            valuePrefix="KSh "
            ariaLabel={`Sample daily revenue over the ${rangeLabel}`}
          />
        </Panel>

        <Panel title="Recent activity" action={<DemoBadge feature="activityFeed" />}>
          <ol className="space-y-4">
            {activity.map((item) => (
              <li key={item.id} className="flex gap-3">
                <span
                  aria-hidden="true"
                  className="mt-1.5 size-2 shrink-0 rounded-full bg-primary"
                />
                <div className="min-w-0">
                  <p className="text-body-sm font-medium text-foreground">{item.title}</p>
                  <p className="text-caption text-muted-foreground">{item.detail}</p>
                  <p className="mt-0.5 text-caption text-muted-foreground/80">
                    {formatRelative(item.at)}
                  </p>
                </div>
              </li>
            ))}
          </ol>
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
