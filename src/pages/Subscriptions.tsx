import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarClock, ChevronDown, Download, Wallet } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { Pagination } from "@/components/app/Pagination";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/app/States";
import { StatCard } from "@/components/app/StatCard";
import { Pill, PropertyStatusBadge, SubscriptionStatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { fetchPlatformCounts, listAdminSubscriptions } from "@/lib/api/admin";
import type { AdminSubscription, SubscriptionGrant } from "@/lib/api/types";
import { downloadCsv } from "@/lib/export-csv";
import { formatDate, formatDateTime, formatKes, formatNumber } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";

/**
 * Subscriptions — Milestone 5, live.
 *
 * This screen is a **lapse queue**, not a directory. The backend orders by `expiresAt`
 * ascending rather than newest-first, which is the whole design: page one of the active
 * tab is what an operator should be chasing today.
 *
 * What a "subscription" is here matters, because the word usually means something else.
 * There are no plans, no tiers, no monthly billing and no cancellation. A landlord buys
 * a **30-day term on one property**, priced per rentable unit — a 3-unit property costs
 * 3 × the unit price — and when it lapses the listing stops being visible until they buy
 * another. So a landlord with four properties has four independent rows here, which can
 * be any mix of active and lapsed, and "MRR" is not a figure that exists.
 *
 * Tenant day passes are the other half of Milestone 5 and are deliberately **not** in
 * this table. They are a different unit entirely — a pass belongs to a person, a term
 * belongs to a property — so they get a count and a link rather than a shared table or a
 * shared denominator.
 */

const PAGE_SIZE = 20;

type TabKey = "active" | "lapsed" | "all";

const TABS: { key: TabKey; label: string }[] = [
  { key: "active", label: "Active" },
  { key: "lapsed", label: "Lapsed" },
  { key: "all", label: "All terms" },
];

/** `?expired=` takes a boolean or nothing at all; `"all"` is the nothing. */
const EXPIRED_PARAM: Record<TabKey, boolean | undefined> = {
  active: false,
  lapsed: true,
  all: undefined,
};

const GRANT_LABELS: Record<SubscriptionGrant["kind"], string> = {
  PURCHASE: "First term",
  RENEWAL: "Renewal",
  TOPUP: "Units added",
};

export default function Subscriptions() {
  const [tab, setTab] = useState<TabKey>("active");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [tab]);

  const { data, error, loading, reload } = useAsync(
    (signal) =>
      listAdminSubscriptions({
        page,
        limit: PAGE_SIZE,
        expired: EXPIRED_PARAM[tab],
        signal,
      }),
    [tab, page],
  );

  /**
   * The dashboard call, for the three platform-wide totals this screen can't derive from
   * a page of rows. It is nine grouped queries in one request, and two of the numbers it
   * returns — active and lapsed term counts — are exactly the cards below, so it pays for
   * itself rather than being fetched for `tenantPassesLive` alone.
   */
  const counts = useAsync((signal) => fetchPlatformCounts(signal), []);
  const summary = counts.data?.subscriptions;

  const rows = data?.items ?? [];
  const pagination = data?.pagination;

  function exportRows() {
    downloadCsv({
      filename: `subscriptions-${tab}-page-${page}.csv`,
      columns: [
        "Property",
        "Listing status",
        "Landlord",
        "M-Pesa number",
        "Paid units",
        "Current units",
        "Unpaid units",
        "Price per unit at purchase (KES)",
        "Term total (KES)",
        "State",
        "Started",
        "Expires",
      ],
      rows: rows.map((row) => [
        row.propertyTitle,
        row.propertyStatus,
        row.landlord?.businessName ?? "",
        row.landlord?.mpesaNumber ?? "",
        row.paidUnits,
        row.currentUnits,
        row.unpaidUnits,
        row.unitPrice,
        row.paidUnits * row.unitPrice,
        row.active ? "ACTIVE" : "LAPSED",
        formatDate(row.startedAt),
        formatDate(row.expiresAt),
      ]),
      scopeNote: pagination
        ? `Page ${page} of the ${tab === "all" ? "full" : tab} list — ${rows.length} of ${pagination.total} terms. There is no server-side export.`
        : undefined,
    });
  }

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Listing terms: one 30-day block per property, priced per rentable unit."
        actions={
          <Button variant="outline" onClick={exportRows} disabled={rows.length === 0}>
            <Download />
            Export
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard
          label="Active terms"
          value={summary ? formatNumber(summary.landlordActive) : "—"}
          note="Properties with time left"
          icon={Wallet}
        />
        <StatCard
          label="Lapsed terms"
          value={summary ? formatNumber(summary.landlordLapsed) : "—"}
          note="Listings no longer covered"
          icon={CalendarClock}
        />
      </div>

      {/*
        Passes and terms are counted in different units — people versus properties — so
        this sits apart from the cards above rather than becoming a third one beside them.
      */}
      <p className="mt-4 flex flex-wrap items-center gap-x-1.5 gap-y-1 rounded-xl border border-border bg-surface px-4 py-3 text-body-sm text-muted-foreground">
        <span className="font-semibold text-foreground">
          {summary ? formatNumber(summary.tenantPassesLive) : "—"} tenants
        </span>
        hold a live 24-hour browsing pass right now. Passes aren't listed here — they belong to a
        person, not a property.
        <Link
          to="/payments?purpose=TENANT_DAILY_ACCESS"
          className="inline-flex items-center gap-1 font-medium text-primary underline-offset-4 hover:underline"
        >
          See the payments that bought them
          <ArrowRight aria-hidden="true" className="size-3.5" />
        </Link>
      </p>

      <div className="mt-4">
        <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
          <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            <TabsList className="w-max">
              {TABS.map((entry) => (
                <TabsTrigger key={entry.key} value={entry.key}>
                  {entry.label}
                  {entry.key === tab && pagination ? ` (${formatNumber(pagination.total)})` : ""}
                </TabsTrigger>
              ))}
            </TabsList>
          </div>
        </Tabs>
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <h2 className="text-h3 text-foreground">
            {tab === "lapsed" ? "Lapsed terms" : "Terms by expiry"}
          </h2>
          <p className="text-caption text-muted-foreground">
            {tab === "lapsed"
              ? "Longest lapsed last — the top of this list is the most recent to fall off."
              : "Soonest to expire first, so the top of this list is what to chase."}
          </p>
        </div>

        {error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={reload} />
          </div>
        ) : loading && rows.length === 0 ? (
          <div className="p-4">
            <TableSkeleton rows={6} columns={6} />
          </div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Wallet}
              title={
                tab === "lapsed" ? "Nothing has lapsed" : tab === "active" ? "No active terms" : "No terms yet"
              }
              body={
                tab === "lapsed"
                  ? "Every term on the platform still has time left."
                  : "A term appears here once a landlord pays for a listing. Nothing is created until the M-Pesa payment settles."
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Property</TableHead>
                    <TableHead>Landlord</TableHead>
                    <TableHead className="text-right">Units</TableHead>
                    <TableHead className="text-right">Term</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Ledger</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    // A term and its ledger are two sibling `<tr>`s, so the key belongs on
                    // a Fragment — the shorthand `<>` cannot carry one.
                    <Fragment key={row.id}>
                      <TableRow>
                        <TableCell>
                          <p className="max-w-56 truncate font-medium text-foreground">
                            {row.propertyTitle}
                          </p>
                          <PropertyStatusBadge status={row.propertyStatus} className="mt-1" />
                        </TableCell>
                        <TableCell>
                          <p className="text-foreground">{row.landlord?.businessName || "—"}</p>
                          <p className="text-caption text-muted-foreground">
                            {row.landlord?.mpesaNumber ?? ""}
                          </p>
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          <UnitsCell row={row} />
                        </TableCell>
                        <TableCell className="text-right tabular-nums text-foreground">
                          {formatKes(row.paidUnits * row.unitPrice)}
                          {/* The price the term was bought at — not today's price. */}
                          <span className="block text-caption text-muted-foreground">
                            {formatKes(row.unitPrice)} per unit
                          </span>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(row.expiresAt)}
                          <span className="block text-caption opacity-80">
                            {timeLeft(row.expiresAt)}
                          </span>
                        </TableCell>
                        <TableCell>
                          <SubscriptionStatusBadge active={row.active} />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() =>
                              setExpandedId((current) => (current === row.id ? null : row.id))
                            }
                            aria-expanded={expandedId === row.id}
                          >
                            {formatNumber(row.grants.length)}
                            <ChevronDown
                              aria-hidden="true"
                              className={expandedId === row.id ? "rotate-180" : undefined}
                            />
                          </Button>
                        </TableCell>
                      </TableRow>

                      {expandedId === row.id ? (
                        <TableRow key={`${row.id}-detail`}>
                          <TableCell colSpan={7} className="bg-surface">
                            <GrantLedger row={row} />
                          </TableCell>
                        </TableRow>
                      ) : null}
                    </Fragment>
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
                        {row.propertyTitle}
                      </p>
                      <p className="truncate text-caption text-muted-foreground">
                        {row.landlord?.businessName || "Unknown landlord"}
                      </p>
                    </div>
                    <SubscriptionStatusBadge active={row.active} />
                  </div>

                  <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-caption">
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Units</dt>
                      <dd className="text-foreground tabular-nums">
                        {formatNumber(row.paidUnits)} paid
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Term</dt>
                      <dd className="text-foreground tabular-nums">
                        {formatKes(row.paidUnits * row.unitPrice)}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Expires</dt>
                      <dd className="text-foreground">{formatDate(row.expiresAt)}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">
                        {row.active ? "Time left" : "Lapsed"}
                      </dt>
                      <dd className="text-foreground">{timeLeft(row.expiresAt)}</dd>
                    </div>
                  </dl>

                  {row.unpaidUnits > 0 ? <UnpaidWarning count={row.unpaidUnits} className="mt-2.5" /> : null}

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => setExpandedId((current) => (current === row.id ? null : row.id))}
                    aria-expanded={expandedId === row.id}
                  >
                    {expandedId === row.id ? "Hide" : "Show"} ledger (
                    {formatNumber(row.grants.length)})
                  </Button>

                  {expandedId === row.id ? (
                    <div className="mt-3 rounded-lg bg-surface p-3">
                      <GrantLedger row={row} />
                    </div>
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
 * Paid versus current units.
 *
 * These agree on every healthy row, so showing both would be noise — the second line
 * appears only when they diverge, and then it is a warning rather than a number, because
 * `unpaidUnits` is not something to bill for. It is a report that a write-side guard in
 * `services/subscriptions.js` was bypassed: adding units to a property is supposed to be
 * refused unless the term covers them.
 */
function UnitsCell({ row }: { row: AdminSubscription }) {
  return (
    <>
      <span className="text-foreground">
        {formatNumber(row.paidUnits)}
        <span className="text-muted-foreground"> paid</span>
      </span>
      {row.currentUnits !== row.paidUnits ? (
        <span className="block text-caption text-muted-foreground">
          {formatNumber(row.currentUnits)} on the property now
        </span>
      ) : null}
      {row.unpaidUnits > 0 ? <UnpaidWarning count={row.unpaidUnits} className="mt-1" /> : null}
    </>
  );
}

function UnpaidWarning({ count, className }: { count: number; className?: string }) {
  return (
    <Pill tone="destructive" className={className}>
      <AlertTriangle aria-hidden="true" className="size-3" />
      {formatNumber(count)} uncovered
    </Pill>
  );
}

/**
 * The term's ledger — what was bought, when, and which payment paid for it.
 *
 * Five entries at most; that is the server's `take: 5`, not a UI choice, so the caption
 * says so rather than implying this is the complete history of a long-running listing.
 * Each `paymentId` links into the Payments screen's search, which matches on our own
 * reference — the two screens are joined by the id the backend already returns.
 */
function GrantLedger({ row }: { row: AdminSubscription }) {
  if (row.grants.length === 0) {
    return (
      <p className="text-caption text-muted-foreground">
        No ledger entries. Terms created before the grants table existed have none.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-caption text-muted-foreground">
        Last {formatNumber(row.grants.length)} {row.grants.length === 1 ? "entry" : "entries"},
        newest first. The server sends at most five.
      </p>
      <ul className="space-y-2">
        {row.grants.map((grant) => (
          <li
            key={grant.paymentId}
            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-caption"
          >
            <span className="flex items-baseline gap-2">
              <Pill tone={grant.kind === "TOPUP" ? "info" : "primary"}>
                {GRANT_LABELS[grant.kind]}
              </Pill>
              <span className="text-foreground">
                {formatNumber(grant.units)} unit{grant.units === 1 ? "" : "s"} ·{" "}
                {formatKes(grant.amount)}
              </span>
              <span className="text-muted-foreground">{formatDateTime(grant.createdAt)}</span>
            </span>
            <Link
              to={`/payments?search=${encodeURIComponent(grant.paymentId)}`}
              className="font-mono text-primary underline-offset-4 hover:underline"
            >
              {grant.paymentId}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * How long a term has, or how long ago it went.
 *
 * `formatRelative` in `lib/format.ts` deliberately declines future dates — it is built
 * for "created 3 hours ago" — and an expiry is the one place this console needs the other
 * direction. Days only: nobody chases a renewal by the hour.
 */
function timeLeft(expiresAt: string): string {
  const expiry = new Date(expiresAt).getTime();
  if (Number.isNaN(expiry)) return "—";

  const days = Math.round((expiry - Date.now()) / 86_400_000);
  if (days === 0) return "expires today";
  if (days === 1) return "1 day left";
  if (days > 1) return `${formatNumber(days)} days left`;
  if (days === -1) return "lapsed yesterday";
  return `lapsed ${formatNumber(Math.abs(days))} days ago`;
}
