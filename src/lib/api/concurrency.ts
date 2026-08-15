/**
 * A cap on how many requests this console has in flight at once.
 *
 * This exists because of one line in the backend's environment. It used to read:
 *
 *     ?pgbouncer=true&connection_limit=1
 *
 * `connection_limit=1` is Supabase's advice for *serverless* functions, where each
 * invocation is its own short-lived process. The API is one long-lived container, so
 * it gave the whole process a single connection to a database in `eu-central-1` —
 * where a TCP connect measures 0.5–2.7s from Nairobi and a query round trip runs
 * about a second. Prisma queues every query onto that connection and throws once one
 * has waited `pool_timeout` for it.
 *
 * A wide `Promise.all` was therefore not impolite but fatal. The dashboard opened
 * with six count requests at once, each running its own two-query `Promise.all`
 * server-side; twelve queries single-file down that link exceeded the ten-second
 * timeout, and the stragglers 500ed. Measured, it was an exact staircase — 2.2s,
 * 4.2s, 6.3s, 8.1s, 9.8s, then two timeouts. React's StrictMode doubles the mount in
 * development, so it was worse there.
 *
 * That backend now runs `connection_limit=10&pool_timeout=20` and serves
 * `GET /admin/dashboard`, so the dashboard is a single request and the arithmetic is
 * no longer tight. Two is kept deliberately anyway:
 *
 *   - It bounds the damage when a screen fans out per-row. `listPropertiesWithLandlord`
 *     is N+1 by necessity, and N is a page of listings, not a fixed number.
 *   - It is the only value that is safe against *both* backend versions. The console
 *     still falls back to six count requests when `/admin/dashboard` 404s, and that
 *     fallback exists precisely for a backend that has not been redeployed — which is
 *     also a backend still holding one connection.
 *   - Two requests in flight also survives the StrictMode double-mount: four
 *     concurrent requests was the last rung of that staircase that did not time out.
 *
 * Raising it to about five is reasonable once every environment has the pooled
 * connection limit. It should not exceed the backend's `connection_limit` divided by
 * the two queries each admin list route runs.
 */
export const REQUEST_CONCURRENCY = 2;

/**
 * Run `tasks` with at most `limit` of them in flight, preserving input order.
 *
 * Failure semantics match `Promise.all` on purpose: the first rejection rejects
 * the whole call. A dashboard that quietly renders five of six counts is worse
 * than one that says it could not load — a missing number is invisible, and an
 * operator suspends accounts on the strength of these figures. Callers that
 * genuinely can tolerate a partial result (a property row whose landlord name
 * failed to resolve, say) catch inside their own task and return a fallback.
 */
export async function runWithConcurrency<T>(
  tasks: ReadonlyArray<() => Promise<T>>,
  limit: number = REQUEST_CONCURRENCY,
): Promise<T[]> {
  const results = new Array<T>(tasks.length);
  let next = 0;

  const workers = Array.from({ length: Math.max(1, Math.min(limit, tasks.length)) }, async () => {
    // Each worker pulls the next index until the queue is drained. `next++` is
    // safe without a lock: this is one JavaScript thread, and the increment
    // happens synchronously before the first await.
    while (next < tasks.length) {
      const index = next++;
      results[index] = await tasks[index]();
    }
  });

  await Promise.all(workers);
  return results;
}
