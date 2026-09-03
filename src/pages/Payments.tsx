import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Receipt, RefreshCw, TrendingUp, Wallet } from "lucide-react";
import { toast } from "sonner";

import { BarChart } from "@/components/app/charts";
import { PageHeader, Panel } from "@/components/app/PageHeader";
import { Pagination } from "@/components/app/Pagination";
import { RangeSelect } from "@/components/app/RangeSelect";
import { SearchInput, Toolbar } from "@/components/app/SearchInput";
import { EmptyState, ErrorState, PanelSkeleton, Spinner, TableSkeleton } from "@/components/app/States";
import { PaymentStatusBadge } from "@/components/app/StatusBadge";
import { StatCard } from "@/components/app/StatCard";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { fetchRevenueSeries, listAdminPayments, reconcileAdminPayment } from "@/lib/api/admin";
import {
  PAYMENT_PURPOSES,
  PAYMENT_STATUSES,
  PURPOSE_LABELS,
  type AdminPayment,
  type PaymentPurpose,
  type PaymentStatus,
} from "@/lib/api/types";
import { downloadCsv } from "@/lib/export-csv";
import { formatDateTime, formatKes, formatKesCompact, formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { dateLabel, daysForRange, type RangeKey } from "@/lib/series";

/**
 * Payments Overview — Milestones 4 and 5, live.
 *
 * Two independent requests, deliberately not merged. `GET /admin/payments` pages the
 * table and answers "show me this transaction"; `GET /admin/payments/revenue` sums
 * settled money by day and answers "how much came in". They move on different inputs —
 * the range changes only the second, a filter only the first — so combining them would
 * refetch a 90-day series every time someone typed into the search box.
 *
 * Everything above the table describes **settled** money only. The stat cards and the
 * bars come from the same payload, so a card cannot disagree with the chart beside it;
 * neither is affected by the table's filters, and the panel says so rather than letting
 * an operator assume the filter narrowed the total too.
 *
 * The one action here is **reconcile**: ask PayHero what happened to a payment that is
 * still pending. M-Pesa callbacks are routinely lost, and a payment stuck at `QUEUED`
 * with money already deducted is the worst state this system can be in — this is the
 * manual answer, and it is idempotent, so it needs no confirmation step.
 */

const PAGE_SIZE = 20;

/** Only these two are worth asking the gateway about; the rest are already terminal. */
const RECONCILABLE: PaymentStatus[] = ["PENDING", "QUEUED"];

const STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: "Pending",
  QUEUED: "Queued",
  SUCCESS: "Successful",
  FAILED: "Failed",
  CANCELLED: "Cancelled",
};

export default function Payments() {
  /**
   * The dashboard's "Pending payments" card and the Subscriptions screen's tenant-pass
   * line both link here with a filter already chosen, so the initial state is read from
   * the URL. Only the initial state — the selects own it after that, which keeps this
   * from fighting the user's own clicks.
   */
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<PaymentStatus | "all">(() =>
    readParam(searchParams.get("status"), PAYMENT_STATUSES),
  );
  const [purpose, setPurpose] = useState<PaymentPurpose | "all">(() =>
    readParam(searchParams.get("purpose"), PAYMENT_PURPOSES),
  );
  const [searchInput, setSearchInput] = useState(() => searchParams.get("search") ?? "");

  const [range, setRange] = useState<RangeKey>("30d");
  const [page, setPage] = useState(1);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const search = useDebouncedValue(searchInput.trim());
  const days = daysForRange(range);

  useEffect(() => {
    setPage(1);
  }, [status, purpose, search]);

  const { data, error, loading, reload, setData } = useAsync(
    (signal) =>
      listAdminPayments({
        page,
        limit: PAGE_SIZE,
        status: status === "all" ? "" : status,
        purpose: purpose === "all" ? "" : purpose,
        search,
        signal,
      }),
    [page, status, purpose, search],
  );

  const revenue = useAsync((signal) => fetchRevenueSeries({ days, signal }), [days]);

  const rows = data?.items ?? [];
  const pagination = data?.pagination;

  const series = revenue.data;
  /** Successful payments in the window — the count behind the money, from the same array. */
  const settledCount = series?.points.reduce((sum, point) => sum + point.count, 0) ?? 0;
  const average = series && settledCount > 0 ? series.total / settledCount : null;
  const rangeLabel = days === 7 ? "last 7 days" : days === 30 ? "last 30 days" : "last 90 days";

  /**
   * Fold a reconciled payment back into the loaded page.
   *
   * A **merge**, not a replace: the reconcile route returns the narrow payment DTO, so
   * swapping the row wholesale would drop the payer's name and the gateway references
   * that only `GET /admin/payments` sends.
   */
  function patchRow(id: string, settled: Partial<AdminPayment>) {
    setData((previous) =>
      previous
        ? {
            ...previous,
            items: previous.items.map((item) => (item.id === id ? { ...item, ...settled } : item)),
          }
        : undefined,
    );
  }

  async function reconcile(row: AdminPayment) {
    setBusyIds((current) => [...current, row.id]);
    try {
      const { payment, applied, message } = await reconcileAdminPayment(row.id);
      patchRow(row.id, payment);

      // `applied: false` is good news, not a failure — the gateway simply had nothing
      // new to say. The backend words all four outcomes; show its wording rather than
      // inventing a second vocabulary that could drift from it.
      if (applied) {
        toast.success(message ?? `Payment reconciled: ${payment.status}.`);
        // Money may have moved, so the totals above the table are now stale.
        if (payment.status === "SUCCESS") revenue.reload();
      } else {
        toast.info(message ?? "Nothing new from the provider yet.");
      }
    } catch (caught) {
      toast.error("Couldn't reach the provider", {
        description: caught instanceof Error ? caught.message : "Please try again.",
      });
    } finally {
      setBusyIds((current) => current.filter((value) => value !== row.id));
    }
  }

  function exportRows() {
    downloadCsv({
      filename: `payments-page-${page}.csv`,
      columns: [
        "Reference",
        "M-Pesa receipt",
        "Payer",
        "Email",
        "Phone",
        "Purpose",
        "Units",
        "Amount (KES)",
        "Status",
        "Result",
        "Created",
        "Settled",
        "Gateway reference",
      ],
      rows: rows.map((row) => [
        row.transactionReference,
        row.mpesaReceipt ?? "",
        row.user?.name ?? "",
        row.user?.email ?? "",
        row.phoneNumber ?? "",
        PURPOSE_LABELS[row.purpose] ?? row.purpose,
        row.unitCount ?? "",
        row.amount,
        row.status,
        row.resultDesc ?? row.failureReason ?? "",
        formatDateTime(row.createdAt),
        row.settledAt ? formatDateTime(row.settledAt) : "",
        row.gatewayReference ?? "",
      ]),
      scopeNote: pagination
        ? `Page ${page} only — ${rows.length} of ${pagination.total} payments${describeFilters(status, purpose, search)}. There is no server-side export.`
        : undefined,
    });
  }

  const filtered = status !== "all" || purpose !== "all" || search.length > 0;

  return (
    <>
      <PageHeader
        title="Payments"
        description="Every M-Pesa transaction on the platform, and what settled."
        actions={
          <>
            <RangeSelect value={range} onChange={setRange} className="w-full sm:w-44" />
            <Button variant="outline" onClick={exportRows} disabled={rows.length === 0}>
              <Download />
              Export
            </Button>
          </>
        }
      />

      {/* Settled money for the selected range. Independent of the table's filters. */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={`Revenue · ${rangeLabel}`}
          value={series ? formatKesCompact(series.total) : "—"}
          note={series ? formatKes(series.total) : "Loading"}
          icon={Wallet}
        />
        <StatCard
          label={`Successful payments · ${rangeLabel}`}
          value={series ? formatNumber(settledCount) : "—"}
          note="Settled transactions"
          icon={TrendingUp}
        />
        <StatCard
          label="Average payment"
          value={average === null ? "—" : formatKes(Math.round(average))}
          note={average === null ? "Nothing settled in this range" : "Across the range"}
          icon={Receipt}
        />
      </div>

      <div className="mt-4">
        <Panel
          title="Revenue trend"
          description={
            series
              ? `${formatKes(series.total)} settled over the ${rangeLabel} · not narrowed by the filters below`
              : "Successful payments per day"
          }
        >
          {revenue.error ? (
            <ErrorState error={revenue.error} onRetry={revenue.reload} />
          ) : !series ? (
            <PanelSkeleton />
          ) : (
            <BarChart
              points={series.points.map((point) => ({
                label: dateLabel(point.date, series.days),
                value: point.amount,
              }))}
              valuePrefix="KSh "
              ariaLabel={`Money settled per day over the ${rangeLabel}`}
            />
          )}
        </Panel>
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-h3 text-foreground">Transactions</h2>
          <p className="text-caption text-muted-foreground">
            {pagination
              ? `${formatNumber(pagination.total)} ${filtered ? "matching" : "in total"}, newest first`
              : "Newest first"}
          </p>
        </div>

        <Toolbar>
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Receipt, reference, phone, name or email"
            className="sm:min-w-64 sm:flex-1"
          />

          <Select
            value={status}
            onValueChange={(value) => setStatus(value as PaymentStatus | "all")}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Payment status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PAYMENT_STATUSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {STATUS_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={purpose}
            onValueChange={(value) => setPurpose(value as PaymentPurpose | "all")}
          >
            <SelectTrigger className="w-full sm:w-44" aria-label="What was paid for">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All purposes</SelectItem>
              {PAYMENT_PURPOSES.map((value) => (
                <SelectItem key={value} value={value}>
                  {PURPOSE_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Toolbar>

        {error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={reload} />
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="p-4">
            <TableSkeleton rows={6} columns={7} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Receipt}
              title={filtered ? "No payments match" : "No payments yet"}
              body={
                filtered
                  ? "Try clearing the search or widening the status and purpose filters."
                  : "Nothing has been paid for on the platform yet. Rows appear here the moment an STK push is initiated."
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reference</TableHead>
                    <TableHead>Payer</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Receipt</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-mono text-caption text-muted-foreground">
                        {row.transactionReference}
                      </TableCell>
                      <TableCell>
                        <p className="font-medium text-foreground">{row.user?.name || "—"}</p>
                        <p className="text-caption text-muted-foreground">
                          {row.phoneNumber ?? row.user?.email ?? ""}
                        </p>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {PURPOSE_LABELS[row.purpose] ?? row.purpose}
                        {/* Only the per-unit purposes carry a count; it explains the amount. */}
                        {row.unitCount ? (
                          <span className="block text-caption">
                            {formatNumber(row.unitCount)} unit{row.unitCount === 1 ? "" : "s"}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="font-mono text-caption text-muted-foreground">
                        {row.mpesaReceipt ?? "—"}
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-foreground">
                        {formatKes(row.amount)}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={row.status} />
                        {/* Why it failed, in the gateway's own words, where it fits. */}
                        {row.status === "FAILED" || row.status === "CANCELLED" ? (
                          <span className="mt-1 block max-w-40 truncate text-caption text-muted-foreground">
                            {row.resultDesc ?? row.failureReason ?? ""}
                          </span>
                        ) : null}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(row.settledAt ?? row.createdAt)}
                      </TableCell>
                      <TableCell className="text-right">
                        {RECONCILABLE.includes(row.status) ? (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void reconcile(row)}
                                disabled={busyIds.includes(row.id)}
                              >
                                {busyIds.includes(row.id) ? <Spinner /> : <RefreshCw />}
                                Reconcile
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              Ask M-Pesa what happened to this payment. Safe to repeat.
                            </TooltipContent>
                          </Tooltip>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-medium text-foreground">
                        {row.user?.name || row.phoneNumber || "Unknown payer"}
                      </p>
                      <p className="truncate font-mono text-caption text-muted-foreground">
                        {row.mpesaReceipt ?? row.transactionReference}
                      </p>
                      <p className="mt-1.5 text-caption text-muted-foreground">
                        {PURPOSE_LABELS[row.purpose] ?? row.purpose}
                        {row.unitCount ? ` · ${formatNumber(row.unitCount)} units` : ""}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {formatDateTime(row.settledAt ?? row.createdAt)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-body-sm font-semibold tabular-nums text-foreground">
                        {formatKes(row.amount)}
                      </p>
                      <PaymentStatusBadge status={row.status} className="mt-1.5" />
                    </div>
                  </div>
                  {RECONCILABLE.includes(row.status) ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3 w-full"
                      onClick={() => void reconcile(row)}
                      disabled={busyIds.includes(row.id)}
                    >
                      {busyIds.includes(row.id) ? <Spinner /> : <RefreshCw />}
                      Reconcile with M-Pesa
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>

            {pagination ? (
              <Pagination
                page={pagination.page || page}
                limit={pagination.limit || PAGE_SIZE}
                total={pagination.total}
                totalPages={Math.max(1, pagination.totalPages)}
                onPageChange={setPage}
              />
            ) : null}
          </>
        )}
      </section>
    </>
  );
}

/**
 * Read one filter out of the query string, accepting only a value the backend knows.
 *
 * A bad `?status=` would otherwise reach the API and come back a `VALIDATION_ERROR`,
 * turning a mistyped link into an error screen instead of an unfiltered list.
 */
function readParam<T extends string>(raw: string | null, allowed: T[]): T | "all" {
  const value = raw?.toUpperCase() ?? "";
  return (allowed as string[]).includes(value) ? (value as T) : "all";
}

/** The filter state, in words, for the CSV's scope line. */
function describeFilters(
  status: PaymentStatus | "all",
  purpose: PaymentPurpose | "all",
  search: string,
): string {
  const parts: string[] = [];
  if (status !== "all") parts.push(STATUS_LABELS[status].toLowerCase());
  if (purpose !== "all") parts.push(PURPOSE_LABELS[purpose].toLowerCase());
  if (search) parts.push(`matching "${search}"`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}
