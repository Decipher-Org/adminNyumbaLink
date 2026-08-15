/**
 * Display formatters for the admin console.
 *
 * Self-contained rather than imported from the tenant client: this app has no
 * marketing pages, and the numbers it shows are different in kind — counts in the
 * tens of thousands, revenue in the millions, deltas against a previous period.
 * The rent helpers the tenant app needs are absent; the compact/percent helpers
 * it doesn't need live here.
 */

const KES = new Intl.NumberFormat("en-KE");

/** "12,540" — plain thousands separators. */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return KES.format(value);
}

/** "KSh 245,300" — full precision, for tables and single transactions. */
export function formatKes(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return `KSh ${KES.format(Math.round(amount))}`;
}

/**
 * "KSh 3.24M" — for stat cards, where the exact shilling is noise and the width
 * is tight. Anything under 100,000 stays exact, because "KSh 45.8K" is harder to
 * read than "KSh 45,800" and saves nothing.
 */
export function formatKesCompact(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  const abs = Math.abs(amount);
  if (abs >= 1_000_000_000) return `KSh ${(amount / 1_000_000_000).toFixed(2)}B`;
  if (abs >= 1_000_000) return `KSh ${(amount / 1_000_000).toFixed(2)}M`;
  return formatKes(amount);
}

/** "125.4K" — compact counts for chart axes and dense cards. */
export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 10_000) return `${Math.round(value / 1_000)}K`;
  if (abs >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return String(value);
}

/**
 * "+18.6%" — always signed, because the sign is the information. A `0` reads as
 * "0.0%" with no sign rather than "+0.0%", which would imply growth.
 */
export function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `${sign}${Math.abs(value).toFixed(1)}%`;
}

/** "59.1%" — unsigned share of a whole. */
export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

/** Compact absolute date — "12 Aug 2026". Avoids locale-ambiguous 08/12. */
export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

/** "12 Aug 2026, 14:05" — for audit trails, where the hour matters. */
export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${formatDate(date)}, ${date.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

/**
 * "3 days ago". Falls back to an absolute date past a month, where a relative
 * figure stops being easier to read than the date itself.
 */
export function formatRelative(value: string | Date | null | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (seconds < 0) return formatDate(date);
  if (seconds < 60) return "just now";

  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;

  const days = Math.round(hours / 24);
  if (days < 31) return `${days} ${days === 1 ? "day" : "days"} ago`;

  return formatDate(date);
}

/** "Kilimani, Nairobi" — estate included only when the backend has one. */
export function formatLocation(parts: {
  estate?: string | null;
  town?: string | null;
  county?: string | null;
}): string {
  const joined = [parts.estate, parts.town, parts.county].filter(Boolean).join(", ");
  return joined || "—";
}

/** Two-letter avatar fallback. Handles single-word names and empty strings. */
export function initials(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

/** "TENANT" -> "Tenant". Used for roles and statuses coming off the wire. */
export function formatEnum(value: string | null | undefined): string {
  if (!value) return "—";
  return value
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/** "1 to 10 of 4,852" — the range line under every table. */
export function formatRange(page: number, limit: number, total: number): string {
  if (total === 0) return "No results";
  const first = (page - 1) * limit + 1;
  const last = Math.min(page * limit, total);
  return `Showing ${formatNumber(first)} to ${formatNumber(last)} of ${formatNumber(total)}`;
}
