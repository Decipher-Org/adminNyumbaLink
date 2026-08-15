/**
 * Hold a value back until it stops changing.
 *
 * Every admin list screen has a search box wired to a server query. Without this,
 * "kilimani" is eight requests, seven of them already stale by the time they
 * land — and the authenticated rate limit is 300 requests per 15 minutes, which a
 * couple of impatient searches can genuinely eat into.
 */

import { useEffect, useState } from "react";

export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
