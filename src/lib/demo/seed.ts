/**
 * Deterministic pseudo-values for the demo layer.
 *
 * Every fake figure in this app is derived from a key rather than drawn from
 * `Math.random()`, so a landlord shows the same document count in the approval
 * queue as on their detail panel, and a stat card doesn't jitter on every render.
 * Random values would make two screens disagree about the same "fact", which
 * reads as a bug rather than as sample data.
 */

/**
 * Small FNV-1a hash. Not cryptographic and not trying to be — it only has to
 * turn an id into a stable-looking number.
 */
export function seedFrom(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

/** A stable pseudo-value in `[min, max]` for a given key. */
export function seededBetween(key: string, min: number, max: number): number {
  if (max <= min) return min;
  return min + (seedFrom(key) % (max - min + 1));
}

/** A stable pick from a list, for when the fake value is a label not a number. */
export function seededPick<T>(key: string, options: readonly T[]): T {
  return options[seedFrom(key) % options.length];
}

/** A stable decimal in `[min, max]`, one place — for percentages and deltas. */
export function seededDecimal(key: string, min: number, max: number): number {
  const scaled = seededBetween(key, Math.round(min * 10), Math.round(max * 10));
  return scaled / 10;
}

/** `n` days ago as an ISO string. Keeps demo timelines relative to "now". */
export function daysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/** `n` minutes ago as an ISO string, for the activity feed's relative times. */
export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}
