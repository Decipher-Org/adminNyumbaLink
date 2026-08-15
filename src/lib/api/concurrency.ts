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
 * `GET /admin/dashboard`. Replaying the same seven-request fan-out afterwards: 0.9s,
 * 1.8s, and five more inside 2.5s, all 200 — parallel rather than single-file. The
 * dashboard itself is now one 0.84s request plus one 0.84s page of properties.
 *
 * Four is chosen against the pool rather than guessed: each admin list route runs two
 * queries, so four requests in flight occupies eight of ten connections, and a
 * StrictMode double-mount briefly needing sixteen drains in two waves well inside the
 * twenty-second timeout. The cap is kept at all, rather than removed, for two reasons:
 *
 *   - It bounds the damage when a screen fans out per-row. `listPropertiesWithLandlord`
 *     is N+1 by necessity, and N is a page of listings, not a fixed number. That is
 *     the only caller for which this value still changes anything measurable.
 *   - The console still falls back to six count requests when `/admin/dashboard`
 *     answers 404, and a backend without that route is also a backend that may still
 *     be holding one connection.
 *
 * It should not exceed the backend's `connection_limit` divided by the two queries
 * each admin list route runs.
 */
export const REQUEST_CONCURRENCY = 4;

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
