/**
 * Date ranges and chart-point shapes, shared by every screen with a trend on it.
 *
 * These lived in `lib/demo/dashboard.ts` while the only charts were demo charts. They
 * are formatting helpers, not fake data — `RangeKey` is the selector's vocabulary and
 * `TrendPoint` is what the chart components take — and real revenue now depends on
 * them, so leaving them under a directory whose name asserts "none of this is real"
 * would make that name a lie.
 *
 * The three windows are also the three the backend accepts on
 * `GET /admin/payments/revenue`, which validates `days` against an allow-list. Keep
 * them in step: a fourth option here would be a `400` there.
 */

export type RangeKey = "7d" | "30d" | "90d";

export const RANGE_OPTIONS: { value: RangeKey; label: string; days: 7 | 30 | 90 }[] = [
  { value: "7d", label: "Last 7 days", days: 7 },
  { value: "30d", label: "Last 30 days", days: 30 },
  { value: "90d", label: "Last 90 days", days: 90 },
];

export function daysForRange(range: RangeKey): 7 | 30 | 90 {
  return RANGE_OPTIONS.find((option) => option.value === range)?.days ?? 7;
}

export type TrendPoint = { label: string; value: number };

/**
 * "Mon" for a week, "20 May" for anything longer, where a weekday repeats.
 *
 * Counts back from today by index, so it labels a series that ends today — which both
 * the demo generators and `revenueSeries` produce.
 */
export function pointLabel(index: number, days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - (days - 1 - index));
  if (days <= 7) return date.toLocaleDateString("en-GB", { weekday: "short" });
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/**
 * Label a point by its own `YYYY-MM-DD` rather than by position.
 *
 * Real series carry their dates, and using them is not just tidier: `pointLabel`
 * assumes the window ends today, which is true of the backend's series but would
 * silently mislabel every bar if a request straddled midnight in Nairobi. Parsing as
 * UTC noon avoids the timezone re-shift that `new Date("2026-08-24")` would apply.
 */
export function dateLabel(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return date;
  if (days <= 7) return parsed.toLocaleDateString("en-GB", { weekday: "short" });
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}
