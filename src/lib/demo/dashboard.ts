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
 * counts come from `pagination.total` on live endpoints, revenue and subscriptions
 * come from `GET /admin/dashboard` since Milestones 4–5, and the top-areas panel
 * groups real listings. Only the parts with no endpoint behind them live here.
 */

import type { PropertyCard } from "@/lib/api/types";
import { minutesAgo, seededBetween } from "@/lib/demo/seed";
import { pointLabel, type TrendPoint } from "@/lib/series";

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
      // Sample, but shaped like a real Milestone 5 event: a 30-day term on one
      // property, priced per rentable unit. "Premium plan · KSh 4,500" invented a
      // tier and a monthly fee that neither the schema nor the pricing has.
      title: "Listing term renewed",
      detail: "2 units · KSh 80 · Otieno Properties",
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
    groups.set(key, {
      area,
      county: property.county ?? "",
      listings: 1,
      views: 0,
    });
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
  { area: "Mtwapa", county: "Kilifi", listings: 1_248, views: 12_420 },
  { area: "Nyali", county: "Mombasa", listings: 1_024, views: 10_180 },
  { area: "Diani", county: "Kwale", listings: 862, views: 8_640 },
  { area: "Lamu Town", county: "Lamu", listings: 704, views: 7_210 },
  { area: "Hola", county: "Tana River", listings: 420, views: 4_350 },
  { area: "Voi", county: "Taita-Taveta", listings: 540, views: 5_800 },
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
    (_, index) =>
      seededBetween(`vw:${days}:${index}`, 70, 130) + (index * 30) / days,
  );
  const sum = weights.reduce((total, weight) => total + weight, 0);

  return weights.map((weight, index) => ({
    label: pointLabel(index, days),
    value: Math.round((totals.views * weight) / sum),
  }));
}
