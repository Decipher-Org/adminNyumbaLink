/**
 * Sample data for the dashboard and analytics surfaces.
 *
 * Everything here is fake, and every screen that reads it renders a `<DemoBadge>`
 * or `<DemoNotice>` — see `lib/demo/registry.ts` for the rule and the milestone
 * each entry is waiting on. Nothing here is written anywhere; a reload
 * regenerates it.
 *
 * Values are **seeded, not random**, so the dashboard doesn't visibly jitter on
 * every render and two panels can't disagree about the same figure.
 *
 * Where a number can be real, it is: the dashboard's user, landlord and property
 * counts come from `pagination.total` on live endpoints, and the top-areas panel
 * groups real listings. Only the parts with no endpoint behind them live here.
 */

import type { PropertyCard } from "@/lib/api/types";
import { minutesAgo, seededBetween } from "@/lib/demo/seed";

// ------------------------------------------------------------- date ranges

export type RangeKey = "7d" | "30d" | "90d";

export const RANGE_OPTIONS: { value: RangeKey; label: string; days: number }[] = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
];

export function daysForRange(range: RangeKey): number {
  return RANGE_OPTIONS.find((option) => option.value === range)?.days ?? 7;
}

// ------------------------------------------------------------------ deltas

/**
 * Period-over-period growth for the stat cards.
 *
 * The counts these sit beside are live. These percentages are not: comparing to a
 * previous period needs either a `createdAt` histogram or a stored snapshot, and
 * `GET /admin/users` offers neither. Fixed rather than seeded so they match the
 * approved design, and small enough to be plausible.
 */
export const DEMO_DELTAS = {
  totalUsers: 18.6,
  landlords: 12.4,
  properties: 22.6,
  subscriptions: 23.7,
  revenue: 15.9,
  tenants: 19.2,
  pendingApprovals: -8.3,
} as const;

// ------------------------------------------------------------------ trends

export type TrendPoint = { label: string; value: number };

/** "Mon" for a week, "20 May" for anything longer, where a weekday repeats. */
function pointLabel(index: number, days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1 - index));
  if (days <= 7) return date.toLocaleDateString("en-GB", { weekday: "short" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Daily signups across the range. Trends gently upward — a flat line reads as
 * broken — with seeded noise on top so it looks like real traffic rather than a
 * generated ramp.
 */
export function demoRegistrationsTrend(days: number): TrendPoint[] {
  return Array.from({ length: days }, (_, index) => {
    const growth = 1 + (index / Math.max(1, days - 1)) * 0.9;
    const base = seededBetween(`reg:${days}:${index}`, 42, 96);
    return { label: pointLabel(index, days), value: Math.round(base * growth) };
  });
}

/**
 * Revenue is defined by its **total** rather than its daily values: the stat card
 * says KSh 3.24M for the month, so the bars are scaled to sum to exactly that.
 * Generating bars independently would leave the card and the chart it sits next to
 * quietly contradicting each other.
 */
const DEMO_REVENUE_TOTALS: Record<number, number> = {
  7: 1_842_600,
  30: 3_242_000,
  90: 9_180_400,
};

export function demoRevenueTotal(days: number): number {
  return DEMO_REVENUE_TOTALS[days] ?? Math.round((3_242_000 * days) / 30);
}

export function demoRevenueTrend(days: number): TrendPoint[] {
  const weights = Array.from(
    { length: days },
    (_, index) => seededBetween(`rev:${days}:${index}`, 55, 140) + (index * 45) / days,
  );
  const sum = weights.reduce((total, weight) => total + weight, 0);
  const target = demoRevenueTotal(days);

  return weights.map((weight, index) => ({
    label: pointLabel(index, days),
    value: Math.round((target * weight) / sum),
  }));
}

/** Today / this week / this month, as the Payments cards show them. */
export const DEMO_REVENUE_SUMMARY = {
  today: 245_300,
  week: 1_842_600,
  month: 3_242_000,
  todayDelta: 12.4,
  weekDelta: 18.7,
  monthDelta: 15.9,
} as const;

// ----------------------------------------------------- subscription mix

export type SubscriptionSlice = {
  key: "ACTIVE" | "EXPIRED" | "CANCELLED";
  label: string;
  count: number;
};

/**
 * The subscription donut. `toAdminLandlord` returns a hardcoded "PENDING" for
 * every landlord, so there is no real distribution to read — not even a
 * degenerate one.
 */
export const DEMO_SUBSCRIPTION_MIX: SubscriptionSlice[] = [
  { key: "ACTIVE", label: "Active", count: 3_215 },
  { key: "EXPIRED", label: "Expired", count: 1_822 },
  { key: "CANCELLED", label: "Cancelled", count: 403 },
];

export const DEMO_ACTIVE_SUBSCRIPTIONS = 3_215;

// --------------------------------------------------------- activity feed

export type ActivityKind =
  | "landlord"
  | "property"
  | "subscription"
  | "report"
  | "suspension"
  | "payment";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  at: string;
};

/**
 * The recent-activity feed. Times are relative to now so the panel doesn't read
 * as stale, but nothing generates these: the platform keeps no audit log, so even
 * the admin actions this console performs leave no trace to display.
 */
export function demoActivity(): ActivityItem[] {
  return [
    {
      id: "a1",
      kind: "landlord",
      title: "New landlord registered",
      detail: "Grace Wanjiku submitted verification details",
      at: minutesAgo(3),
    },
    {
      id: "a2",
      kind: "property",
      title: "Property published",
      detail: "2 Bedroom Apartment · Kilimani, Nairobi",
      at: minutesAgo(18),
    },
    {
      id: "a3",
      kind: "subscription",
      title: "Subscription renewed",
      detail: "Premium plan · KSh 4,500 · Otieno Properties",
      at: minutesAgo(64),
    },
    {
      id: "a4",
      kind: "report",
      title: "Listing reported",
      detail: "Studio in Ruaka flagged as misleading photos",
      at: minutesAgo(187),
    },
    {
      id: "a5",
      kind: "suspension",
      title: "Account suspended",
      detail: "brian.k@example.com · repeated policy violations",
      at: minutesAgo(322),
    },
  ];
}

// -------------------------------------------------------------- top areas

export type TopArea = {
  area: string;
  county: string;
  listings: number;
  /** Demo — nothing counts views on a property yet. */
  views: number;
};

/**
 * Top areas by listing volume, from **real** properties.
 *
 * The grouping and the listing counts are live data — `GET /properties` returns
 * `county` and `town` on every card. Only `views` is invented, because no counter
 * exists. The caller passes whatever page it loaded, so the counts describe those
 * rows; screens that can't load the whole catalogue say so beneath the panel.
 */
export function demoTopAreas(properties: PropertyCard[], limit = 5): TopArea[] {
  const groups = new Map<string, TopArea>();

  for (const property of properties) {
    const area = property.town?.trim() || property.county?.trim();
    if (!area) continue;

    const key = `${area.toLowerCase()}|${(property.county ?? "").toLowerCase()}`;
    const existing = groups.get(key);
    if (existing) {
      existing.listings += 1;
      continue;
    }
    groups.set(key, { area, county: property.county ?? "", listings: 1, views: 0 });
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      // Scaled by listing count so a busy area reads as busier, which keeps the
      // ranking sensible instead of shuffling real areas at random.
      views: group.listings * seededBetween(`views:${group.area}`, 180, 1_240),
    }))
    .sort((a, b) => b.views - a.views || b.listings - a.listings)
    .slice(0, limit);
}

/** Shown when there are no live listings to group — the design's own figures. */
export const DEMO_FALLBACK_AREAS: TopArea[] = [
  { area: "Kilimani", county: "Nairobi", listings: 1_248, views: 12_420 },
  { area: "Westlands", county: "Nairobi", listings: 1_024, views: 10_180 },
  { area: "Kileleshwa", county: "Nairobi", listings: 862, views: 8_640 },
  { area: "Lavington", county: "Nairobi", listings: 704, views: 7_210 },
  { area: "Karen", county: "Nairobi", listings: 540, views: 5_800 },
];

// -------------------------------------------------------------- analytics

export type AnalyticsTotals = {
  views: number;
  uniqueVisitors: number;
  inquiries: number;
  favourites: number;
};

export const DEMO_ANALYTICS_DELTAS = {
  views: 21.3,
  uniqueVisitors: 16.9,
  inquiries: 18.4,
  favourites: 23.7,
} as const;

/** The monthly figures from the design, scaled for the selected range. */
export function demoAnalyticsTotals(days: number): AnalyticsTotals {
  const scale = days / 30;
  return {
    views: Math.round(125_430 * scale),
    uniqueVisitors: Math.round(45_820 * scale),
    inquiries: Math.round(3_256 * scale),
    favourites: Math.round(8_752 * scale),
  };
}

export type DeviceSlice = { key: string; label: string; share: number };

/** Mobile-dominant, which is what a Kenyan rental audience actually looks like. */
export const DEMO_DEVICE_SPLIT: DeviceSlice[] = [
  { key: "mobile", label: "Mobile", share: 78.4 },
  { key: "desktop", label: "Desktop", share: 16.7 },
  { key: "tablet", label: "Tablet", share: 4.9 },
];

/** Daily views for the analytics line chart. */
export function demoViewsTrend(days: number): TrendPoint[] {
  const totals = demoAnalyticsTotals(days);
  const weights = Array.from(
    { length: days },
    (_, index) => seededBetween(`vw:${days}:${index}`, 70, 130) + (index * 30) / days,
  );
  const sum = weights.reduce((total, weight) => total + weight, 0);

  return weights.map((weight, index) => ({
    label: pointLabel(index, days),
    value: Math.round((totals.views * weight) / sum),
  }));
}
