/**
 * `?next=` handling.
 *
 * A guard that redirects to login records where the operator was headed, and the
 * login screen sends them back there afterwards. The value is validated before
 * being used as a destination.
 */

/**
 * Only same-site absolute paths are honoured.
 *
 * A `next` that starts with `//` is protocol-relative — the browser reads
 * `//evil.example` as a different host, so a bare "starts with /" check would
 * turn this into an open redirect. `\` is rejected for the same reason: some
 * browsers normalise `/\evil.example` to `//evil.example`.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

export function loginPath(next?: string): string {
  const safe = safeNextPath(next);
  return safe && safe !== "/" ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}
