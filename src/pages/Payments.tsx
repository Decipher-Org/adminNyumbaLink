import { useEffect, useMemo, useState } from "react";
import { Download, Receipt, Smartphone, TrendingUp, Wallet } from "lucide-react";

import { BarChart } from "@/components/app/charts";
import { DemoBadge, DemoNotice } from "@/components/app/DemoBadge";
import { PageHeader, Panel } from "@/components/app/PageHeader";
import { Pagination } from "@/components/app/Pagination";
import { RangeSelect } from "@/components/app/RangeSelect";
import { SearchInput, Toolbar } from "@/components/app/SearchInput";
import { EmptyState } from "@/components/app/States";
import { PaymentStatusBadge, Pill } from "@/components/app/StatusBadge";
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
import {
  DEMO_REVENUE_SUMMARY,
  daysForRange,
  demoRevenueTotal,
  demoRevenueTrend,
  type RangeKey,
} from "@/lib/demo/dashboard";
import {
  demoPayments,
  type PaymentProvider,
  type PaymentPurpose,
  type PaymentStatus,
} from "@/lib/demo/finance";
import { downloadCsv } from "@/lib/export-csv";
import { formatDateTime, formatKes, formatKesCompact, formatNumber } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

/**
 * Payments Overview.
 *
 * Milestone 4 in full: there is no payments table, no M-Pesa daraja integration,
 * and no money has ever moved through this platform. So unlike the rest of the
 * console, this screen has nothing real to anchor to — which is exactly why it
 * leads with a notice rather than a badge in the corner.
 *
 * It is still built properly. When the payments endpoint lands, the only thing
 * that changes is where `rows` comes from: the filters, the table, the mobile card
 * layout, the CSV columns and the totals all describe the shape the real data will
 * have (`reference`, `payer`, `amount`, `provider`, `purpose`, `status`).
 *
 * The three revenue cards keep the design's figures. The bar chart is scaled to
 * sum to the card beside it — see `demoRevenueTrend` — because a chart that
 * disagrees with the number above it is the kind of detail that makes an operator
 * distrust the whole screen.
 */

const PAGE_SIZE = 10;

const PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  SUBSCRIPTION: "Subscription",
  LISTING_BOOST: "Listing boost",
  VERIFICATION: "Verification",
};

export default function Payments() {
  const [range, setRange] = useState<RangeKey>("30d");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<PaymentStatus | "all">("all");
  const [provider, setProvider] = useState<PaymentProvider | "all">("all");

  const search = useDebouncedValue(searchInput.trim().toLowerCase());
  const days = daysForRange(range);

  const all = useMemo(() => demoPayments(), []);

  useEffect(() => {
    setPage(1);
  }, [search, status, provider]);

  const filtered = useMemo(
    () =>
      all.filter((payment) => {
        if (status !== "all" && payment.status !== status) return false;
        if (provider !== "all" && payment.provider !== provider) return false;
        if (search && !`${payment.payer} ${payment.reference}`.toLowerCase().includes(search)) {
          return false;
        }
        return true;
      }),
    [all, status, provider, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const trend = useMemo(() => demoRevenueTrend(days), [days]);
  const rangeTotal = demoRevenueTotal(days);

  /** Settled money only — a pending or failed attempt is not revenue. */
  const collected = useMemo(
    () =>
      filtered
        .filter((payment) => payment.status === "SUCCESS")
        .reduce((sum, payment) => sum + payment.amount, 0),
    [filtered],
  );

  function exportRows() {
    downloadCsv({
      filename: "payments-sample.csv",
      columns: ["Reference", "Payer", "Amount (KES)", "Provider", "Purpose", "Status", "Date"],
      rows: filtered.map((payment) => [
        payment.reference,
        payment.payer,
        payment.amount,
        payment.provider === "MPESA" ? "M-Pesa" : "Card",
        PURPOSE_LABELS[payment.purpose],
        payment.status,
        formatDateTime(payment.createdAt),
      ]),
      scopeNote: "Sample data — no payment has ever been recorded on this platform.",
    });
  }

  return (
    <>
      <PageHeader
        title="Payments"
        description="Revenue and transactions, as they will appear once payments are connected."
        actions={
          <>
            <RangeSelect value={range} onChange={setRange} className="w-full sm:w-44" />
            <Button variant="outline" onClick={exportRows}>
              <Download />
              Export
              <DemoBadge feature="export" />
            </Button>
          </>
        }
      />

      <DemoNotice feature="payments" className="mb-4" />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Today"
          value={formatKesCompact(DEMO_REVENUE_SUMMARY.today)}
          icon={Wallet}
          demo="revenue"
          delta={{ value: DEMO_REVENUE_SUMMARY.todayDelta, note: "vs yesterday", demo: "revenue" }}
        />
        <StatCard
          label="This week"
          value={formatKesCompact(DEMO_REVENUE_SUMMARY.week)}
          icon={TrendingUp}
          demo="revenue"
          delta={{ value: DEMO_REVENUE_SUMMARY.weekDelta, note: "vs last week", demo: "revenue" }}
        />
        <StatCard
          label="This month"
          value={formatKesCompact(DEMO_REVENUE_SUMMARY.month)}
          icon={Receipt}
          demo="revenue"
          delta={{ value: DEMO_REVENUE_SUMMARY.monthDelta, note: "vs last month", demo: "revenue" }}
        />
      </div>

      <div className="mt-4">
        <Panel
          title="Revenue trend"
          description={`${formatKes(rangeTotal)} over the selected range`}
          action={<DemoBadge feature="revenue" />}
        >
          <BarChart
            points={trend}
            valuePrefix="KSh "
            ariaLabel="Sample daily revenue over the selected range"
          />
        </Panel>
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card">
        <div className="flex flex-col gap-1 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-h3 text-foreground">Transactions</h2>
            <p className="text-caption text-muted-foreground">
              {formatNumber(filtered.length)} shown · {formatKes(collected)} settled
            </p>
          </div>
          <Pill tone="warning" className="self-start sm:self-auto">
            Sample transactions
          </Pill>
        </div>

        <Toolbar>
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search payer or reference"
            className="sm:min-w-56 sm:flex-1"
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
              <SelectItem value="SUCCESS">Successful</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="FAILED">Failed</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={provider}
            onValueChange={(value) => setProvider(value as PaymentProvider | "all")}
          >
            <SelectTrigger className="w-full sm:w-36" aria-label="Payment method">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              <SelectItem value="MPESA">M-Pesa</SelectItem>
              <SelectItem value="CARD">Card</SelectItem>
            </SelectContent>
          </Select>
        </Toolbar>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Receipt}
              title="No transactions match"
              body="Try clearing the search or the status filter."
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
                    <TableHead>Method</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((payment) => (
                    <TableRow key={payment.id}>
                      <TableCell className="font-mono text-caption text-muted-foreground">
                        {payment.reference}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">{payment.payer}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {PURPOSE_LABELS[payment.purpose]}
                      </TableCell>
                      <TableCell>
                        <span className="inline-flex items-center gap-1.5 text-body-sm text-muted-foreground">
                          {payment.provider === "MPESA" ? (
                            <Smartphone aria-hidden="true" className="size-3.5" />
                          ) : (
                            <Wallet aria-hidden="true" className="size-3.5" />
                          )}
                          {payment.provider === "MPESA" ? "M-Pesa" : "Card"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums text-foreground">
                        {formatKes(payment.amount)}
                      </TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={payment.status} />
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(payment.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((payment) => (
                <li key={payment.id} className="flex items-start justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate text-body-sm font-medium text-foreground">
                      {payment.payer}
                    </p>
                    <p className="truncate font-mono text-caption text-muted-foreground">
                      {payment.reference}
                    </p>
                    <p className="mt-1.5 text-caption text-muted-foreground">
                      {PURPOSE_LABELS[payment.purpose]} ·{" "}
                      {payment.provider === "MPESA" ? "M-Pesa" : "Card"}
                    </p>
                    <p className="text-caption text-muted-foreground">
                      {formatDateTime(payment.createdAt)}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-body-sm font-semibold tabular-nums text-foreground">
                      {formatKes(payment.amount)}
                    </p>
                    <PaymentStatusBadge status={payment.status} className="mt-1.5" />
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={page}
              limit={PAGE_SIZE}
              total={filtered.length}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </section>
    </>
  );
}
