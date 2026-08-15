/**
 * The load-fetch-render cycle every data screen repeats.
 *
 * There is no react-query here, and this is deliberately not a substitute for
 * one: no cache, no dedupe, no background revalidation. It covers the three
 * things every screen in this app actually needs — abort the previous request
 * when the inputs change, never let a late response overwrite a newer one, and
 * expose `reload` so an error state has something to retry.
 *
 * `deps` is the dependency list, exactly as `useEffect` takes one. The fetcher
 * itself is intentionally *not* a dependency: screens declare it inline, so its
 * identity changes every render and including it would refetch forever. It is
 * read through a ref instead, which means the fetcher must not close over state
 * that isn't also in `deps`.
 */

import { useCallback, useEffect, useRef, useState } from "react";

export type AsyncResult<T> = {
  data: T | undefined;
  error: unknown;
  /** True during the first load and every reload. */
  loading: boolean;
  reload: () => void;
  /**
   * Patch the loaded value in place, for when a mutation's response already
   * says what changed. Cheaper and less jarring than refetching the page —
   * approving one landlord shouldn't blank the queue.
   *
   * The updater may return `undefined` to mean "there is still nothing loaded",
   * which is what a patch does when it arrives before the first response.
   */
  setData: (next: T | ((previous: T | undefined) => T | undefined)) => void;
};

export function useAsync<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
): AsyncResult<T> {
  const [data, setData] = useState<T | undefined>(undefined);
  const [error, setError] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);
  const [nonce, setNonce] = useState(0);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;

    setLoading(true);
    setError(null);

    void (async () => {
      try {
        const result = await fetcherRef.current(controller.signal);
        if (cancelled) return;
        setData(result);
      } catch (err) {
        // An abort is this hook's own doing — the inputs changed or the screen
        // unmounted. Surfacing it would flash an error state on every keystroke
        // of a debounced filter.
        if (cancelled || (err instanceof DOMException && err.name === "AbortError")) return;
        setError(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
    // `fetcher` is absent from this list on purpose — it is read through a ref.
    // See the header comment.
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  return { data, error, loading, reload, setData };
}
