import { useMemo, useState } from "react";
import { Eye, Heart, MessageSquare, Users } from "lucide-react";

import { DonutChart, LineChart, RankedBars } from "@/components/app/charts";
import { DemoBadge, DemoNotice } from "@/components/app/DemoBadge";
import { PageHeader, Panel } from "@/components/app/PageHeader";
import { RangeSelect } from "@/components/app/RangeSelect";
import { StatCard } from "@/components/app/StatCard";
import { PanelSkeleton } from "@/components/app/States";
import { Pill } from "@/components/app/StatusBadge";
import { listProperties } from "@/lib/api/properties";
import {
  DEMO_ANALYTICS_DELTAS,
  DEMO_DEVICE_SPLIT,
  DEMO_FALLBACK_AREAS,
  demoAnalyticsTotals,
  demoTopAreas,
  demoViewsTrend,
} from "@/lib/demo/dashboard";
import { daysForRange, type RangeKey } from "@/lib/series";
import { formatCompact, formatNumber, formatPercent } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";

/**
 * Analytics Summary.
 *
 * Milestone 8+. Nothing counts a view, a visitor, an inquiry or a favourite yet —
 * there is no analytics table and no event pipeline — so every number on this
 * screen is invented and badged.
 *
 * One thing here is genuinely real, and it is worth keeping separate from the rest:
 * the **areas** in the ranking. Those are grouped from `GET /properties`, so which
 * areas appear and how many listings each has is true; only the view counts beside
 * them are made up. The panel says which half is which rather than letting a real
 * ranking borrow credibility for a fake metric.
 */

const DEVICE_COLORS: Record<string, string> = {
  mobile: "var(--primary)",
  desktop: "var(--info)",
  tablet: "var(--warning)",
};

export default function Analytics() {
  const [range, setRange] = useState<RangeKey>("30d");
  const days = daysForRange(range);

  const { data: properties, loading } = useAsync(
    (signal) => listProperties({ limit: 100, signal }),
    [],
  );

  const totals = useMemo(() => demoAnalyticsTotals(days), [days]);
  const viewsTrend = useMemo(() => demoViewsTrend(days), [days]);

  const areas = useMemo(() => {
    const grouped = demoTopAreas(properties?.items ?? []);
    return grouped.length > 0 ? grouped : DEMO_FALLBACK_AREAS;
  }, [properties]);
  const areasAreReal = (properties?.items.length ?? 0) > 0;

  const totalListings = areas.reduce((sum, area) => sum + area.listings, 0);

  return (
    <>
      <PageHeader
        title="Analytics"
        description="Traffic, engagement and where demand is concentrated."
        actions={<RangeSelect value={range} onChange={setRange} className="w-full sm:w-44" />}
      />

      <DemoNotice feature="analytics" className="mb-4" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total views"
          value={formatCompact(totals.views)}
          note={formatNumber(totals.views)}
          icon={Eye}
          demo="analytics"
          delta={{ value: DEMO_ANALYTICS_DELTAS.views, note: "vs previous period", demo: "analytics" }}
        />
        <StatCard
          label="Unique visitors"
          value={formatCompact(totals.uniqueVisitors)}
          note={formatNumber(totals.uniqueVisitors)}
          icon={Users}
          demo="analytics"
          delta={{
            value: DEMO_ANALYTICS_DELTAS.uniqueVisitors,
            note: "vs previous period",
            demo: "analytics",
          }}
        />
        <StatCard
          label="Inquiries"
          value={formatNumber(totals.inquiries)}
          icon={MessageSquare}
          demo="analytics"
          delta={{
            value: DEMO_ANALYTICS_DELTAS.inquiries,
            note: "vs previous period",
            demo: "analytics",
          }}
        />
        <StatCard
          label="Favourites"
          value={formatNumber(totals.favourites)}
          icon={Heart}
          demo="analytics"
          delta={{
            value: DEMO_ANALYTICS_DELTAS.favourites,
            note: "vs previous period",
            demo: "analytics",
          }}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Views over time"
          description="Listing detail views per day"
          action={<DemoBadge feature="views" />}
          className="lg:col-span-2"
        >
          <LineChart
            points={viewsTrend}
            ariaLabel="Sample listing views per day over the selected range"
          />
        </Panel>

        <Panel title="Views by device" action={<DemoBadge feature="analytics" />}>
          <DonutChart
            slices={DEMO_DEVICE_SPLIT.map((slice) => ({
              key: slice.key,
              label: slice.label,
              value: slice.share,
              color: DEVICE_COLORS[slice.key] ?? "var(--inactive)",
            }))}
            centreValue={formatPercent(DEMO_DEVICE_SPLIT[0].share)}
            centreLabel="mobile"
            formatValue={(value) => formatPercent(value)}
            className="sm:flex-col lg:flex-col"
          />
          <p className="mt-4 text-caption text-muted-foreground">
            A mobile-first split is the assumption the whole console is built on — which is why
            every table here has a card layout underneath it.
          </p>
        </Panel>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Top areas"
          description={
            areasAreReal
              ? `Grouped from ${formatNumber(totalListings)} live listings`
              : "No live listings to group yet"
          }
          action={
            areasAreReal ? (
              <Pill tone="success">Areas real · views sample</Pill>
            ) : (
              <DemoBadge feature="analytics" />
            )
          }
          className="lg:col-span-2"
        >
          {loading && !properties ? (
            <PanelSkeleton />
          ) : (
            <RankedBars
              rows={areas.map((area) => ({
                key: `${area.area}-${area.county}`,
                label: area.area,
                caption: `${area.county} · ${formatNumber(area.listings)} listings`,
                value: area.views,
                valueLabel: formatCompact(area.views),
              }))}
            />
          )}
        </Panel>

        <Panel title="What is missing" description="Before these numbers can be trusted">
          <ul className="space-y-3 text-body-sm text-muted-foreground">
            <li>
              <span className="font-medium text-foreground">View events.</span> Nothing writes a row
              when a listing is opened, so there is no history to aggregate.
            </li>
            <li>
              <span className="font-medium text-foreground">Inquiries.</span> Tenants contact
              landlords off-platform today, so the funnel has no middle.
            </li>
            <li>
              <span className="font-medium text-foreground">Favourites.</span> Milestone 8 adds the
              table; until then a favourite cannot be counted.
            </li>
            <li>
              <span className="font-medium text-foreground">Visitor identity.</span> Unique visitors
              need a session or device signal that is not collected yet.
            </li>
          </ul>
        </Panel>
      </div>
    </>
  );
}
