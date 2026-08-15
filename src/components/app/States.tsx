import { AlertTriangle, RefreshCw, WifiOff } from "lucide-react";
import type { ComponentType, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { ApiError } from "@/lib/api/client";
import { cn } from "@/lib/utils";

/**
 * The three states every data screen needs besides "loaded": nothing here,
 * something broke, and still loading. Sharing them keeps each table from
 * inventing its own empty copy, and keeps a failed fetch from rendering as a blank
 * panel that looks like success — which on an ops screen would read as "no
 * pending landlords" rather than "we couldn't ask".
 */

export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-surface px-6 py-12 text-center",
        className,
      )}
    >
      {Icon ? (
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-secondary text-primary">
          <Icon className="size-5" />
        </span>
      ) : null}
      <p className="text-h3 text-foreground">{title}</p>
      {body ? <p className="mt-1.5 max-w-sm text-body-sm text-muted-foreground">{body}</p> : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}

/**
 * A failed request. The backend's message is shown as-is when it has one — its
 * codes are written for humans and beat a generic apology. A network failure gets
 * the offline treatment instead, because the fix is different.
 *
 * The exception is a 5xx. The API's generic handler answers `"Something went
 * wrong"`, which used to land under a heading reading *Something went wrong* —
 * the same four words twice and nothing an operator could act on. A server error
 * gets its own heading, its own explanation, and the status line, because the one
 * thing worth communicating is that the request failed on the far side and
 * retrying is reasonable.
 */
const GENERIC_SERVER_MESSAGES = new Set([
  "something went wrong",
  "internal server error",
  "internal error",
]);

export function ErrorState({
  error,
  onRetry,
  className,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const isNetwork = apiError?.isNetworkError ?? false;
  const isServer = (apiError?.status ?? 0) >= 500;

  const raw = error instanceof Error && error.message ? error.message.trim() : "";
  const isGeneric = raw === "" || GENERIC_SERVER_MESSAGES.has(raw.toLowerCase());

  const title = isNetwork
    ? "Can't reach the server"
    : isServer
      ? "The server couldn't answer"
      : "Something went wrong";

  const message =
    isServer && isGeneric
      ? "This isn't something you did — the request failed inside the API. The usual cause is a timeout waiting for a database connection, which retrying often clears. If it keeps happening, the API logs will say why."
      : isGeneric
        ? "Something went wrong loading this page."
        : raw;

  const Icon = isNetwork ? WifiOff : AlertTriangle;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-xl border border-destructive/25 bg-destructive-soft px-6 py-12 text-center",
        className,
      )}
    >
      <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-card text-destructive-strong">
        <Icon className="size-5" />
      </span>
      <p className="text-h3 text-destructive-strong">{title}</p>
      <p className="mt-1.5 max-w-md text-body-sm text-destructive-strong/85">{message}</p>
      {apiError && !isNetwork ? (
        <p className="mt-2.5 font-mono text-caption text-destructive-strong/70">
          HTTP {apiError.status} · {apiError.code}
        </p>
      ) : null}
      {onRetry ? (
        <Button variant="outline" className="mt-5" onClick={onRetry}>
          <RefreshCw />
          Try again
        </Button>
      ) : null}
    </div>
  );
}

/** Panel-shaped placeholder for charts and feeds. */
export function PanelSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-xl border border-border bg-card p-4 sm:p-5", className)}>
      <div className="h-4 w-32 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-40 w-full animate-pulse rounded-lg bg-muted" />
    </div>
  );
}

/**
 * Table placeholder.
 *
 * Rendered as a stack of rows rather than inside a `<Table>` so it can stand in
 * for either layout — the `md`+ table or the mobile card list — without either one
 * having to know it's loading.
 */
export function TableSkeleton({ rows = 5, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="divide-y divide-border" aria-hidden="true">
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="flex items-center gap-4 px-4 py-4">
          <div className="size-9 shrink-0 animate-pulse rounded-full bg-muted" />
          {Array.from({ length: columns }, (_, columnIndex) => (
            <div
              key={columnIndex}
              className={cn(
                "h-4 animate-pulse rounded bg-muted",
                columnIndex === 0 ? "flex-1" : "hidden w-20 md:block",
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Inline spinner for a button or a small region. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      role="status"
      aria-label="Loading"
      className={cn(
        "inline-block size-4 animate-spin rounded-full border-2 border-current/25 border-t-current",
        className,
      )}
    />
  );
}
