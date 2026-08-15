import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Check, Download, Wallet } from "lucide-react";

import { DonutChart } from "@/components/app/charts";
import { DemoBadge, DemoNotice } from "@/components/app/DemoBadge";
import { PageHeader, Panel } from "@/components/app/PageHeader";
import { Pagination } from "@/components/app/Pagination";
import { SearchInput, Toolbar } from "@/components/app/SearchInput";
import { EmptyState } from "@/components/app/States";
import { StatCard } from "@/components/app/StatCard";
import { Pill, SubscriptionStatusBadge } from "@/components/app/StatusBadge";
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
import { listLandlords } from "@/lib/api/admin";
import { DEMO_SUBSCRIPTION_MIX } from "@/lib/demo/dashboard";
import {
  DEMO_PLANS,
  demoSubscriptions,
  type PlanName,
  type SubscriptionStatus,
} from "@/lib/demo/finance";
import { downloadCsv } from "@/lib/export-csv";
import { formatDate, formatKes, formatNumber, formatRelative } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

/**
 * Subscriptions.
 *
 * Milestone 5. The one real fact on this screen is the landlord count, which is
 * fetched live — and the reason it is worth fetching is that it makes the gap
 * concrete: `toAdminLandlord` hands back the literal string `"PENDING"` as every
 * landlord's `subscriptionStatus`, so however many landlords exist, not one of them
 * has a plan, an expiry date, or anything gating what they can publish.
 *
 * Everything else — the plans, the renewal table, the status mix — is sample data
 * shaped like what Milestone 5 will store.
 */

const PAGE_SIZE = 10;

export default function Subscriptions() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<SubscriptionStatus | "all">("all");
  const [plan, setPlan] = useState<PlanName | "all">("all");

  const search = useDebouncedValue(searchInput.trim().toLowerCase());

  // Real, and cheap: one request whose only useful field is `pagination.total`.
  const { data: landlords } = useAsync((signal) => listLandlords({ limit: 1, signal }), []);
  const landlordTotal = landlords?.pagination.total;

  const all = useMemo(() => demoSubscriptions(), []);

  useEffect(() => {
    setPage(1);
  }, [search, status, plan]);

  const filtered = useMemo(
    () =>
      all.filter((subscription) => {
        if (status !== "all" && subscription.status !== status) return false;
        if (plan !== "all" && subscription.plan !== plan) return false;
        if (search && !subscription.landlord.toLowerCase().includes(search)) return false;
        return true;
      }),
    [all, status, plan, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const mrr = useMemo(
    () =>
      all
        .filter((subscription) => subscription.status === "ACTIVE")
        .reduce((sum, subscription) => sum + subscription.amount, 0),
    [all],
  );

  /** Renewals due inside a fortnight — the row an operator would chase. */
  const dueSoon = useMemo(() => {
    const horizon = Date.now() + 14 * 24 * 60 * 60 * 1000;
    return all.filter(
      (subscription) =>
        subscription.status === "ACTIVE" && new Date(subscription.expiresAt).getTime() <= horizon,
    ).length;
  }, [all]);

  function exportRows() {
    downloadCsv({
      filename: "subscriptions-sample.csv",
      columns: ["Landlord", "Plan", "Amount (KES)", "Status", "Started", "Expires", "Listings"],
      rows: filtered.map((subscription) => [
        subscription.landlord,
        subscription.plan,
        subscription.amount,
        subscription.status,
        formatDate(subscription.startedAt),
        formatDate(subscription.expiresAt),
        subscription.listings,
      ]),
      scopeNote: "Sample data — every real landlord's subscription status is a placeholder.",
    });
  }

  return (
    <>
      <PageHeader
        title="Subscriptions"
        description="Plans, renewals and the revenue they would generate."
        actions={
          <Button variant="outline" onClick={exportRows}>
            <Download />
            Export
            <DemoBadge feature="export" />
          </Button>
        }
      />

      <DemoNotice feature="subscriptions" className="mb-4" />

      {landlordTotal !== undefined ? (
        <p className="mb-4 rounded-xl border border-border bg-surface px-4 py-3 text-body-sm text-muted-foreground">
          <span className="font-semibold text-foreground">
            {formatNumber(landlordTotal)} landlords
          </span>{" "}
          are registered right now — that number is live. None of them has a plan: the API returns a
          fixed "PENDING" status for every landlord, and nothing on the platform is gated by a
          subscription yet.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active subscriptions"
          value={formatNumber(DEMO_SUBSCRIPTION_MIX[0].count)}
          icon={Wallet}
          demo="subscriptions"
        />
        <StatCard
          label="Monthly recurring"
          value={formatKes(mrr)}
          note="From the sample rows below"
          icon={Wallet}
          demo="subscriptions"
        />
        <StatCard
          label="Renewals due (14 days)"
          value={formatNumber(dueSoon)}
          icon={CalendarClock}
          demo="subscriptions"
        />
        <StatCard
          label="Expired"
          value={formatNumber(DEMO_SUBSCRIPTION_MIX[1].count)}
          icon={CalendarClock}
          demo="subscriptions"
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Panel
          title="Plans"
          description="What each tier would include"
          action={<DemoBadge feature="subscriptions" />}
          className="lg:col-span-2"
          bodyClassName="grid gap-3 sm:grid-cols-3"
        >
          {DEMO_PLANS.map((entry) => (
            <div key={entry.name} className="rounded-lg border border-border p-4">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="text-body font-semibold text-foreground">{entry.name}</h3>
                <Pill tone="primary">{formatNumber(entry.subscribers)}</Pill>
              </div>
              <p className="mt-2 text-h3 text-foreground">{formatKes(entry.price)}</p>
              <p className="text-caption text-muted-foreground">per month</p>
              <ul className="mt-3 space-y-1.5">
                {entry.features.map((feature) => (
                  <li key={feature} className="flex gap-1.5 text-caption text-muted-foreground">
                    <Check aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-success" />
                    {feature}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </Panel>

        <Panel title="Status mix" action={<DemoBadge feature="subscriptions" />}>
          <DonutChart
            slices={[
              {
                key: "active",
                label: "Active",
                value: DEMO_SUBSCRIPTION_MIX[0].count,
                color: "var(--success)",
              },
              {
                key: "expired",
                label: "Expired",
                value: DEMO_SUBSCRIPTION_MIX[1].count,
                color: "var(--destructive)",
              },
              {
                key: "cancelled",
                label: "Cancelled",
                value: DEMO_SUBSCRIPTION_MIX[2].count,
                color: "var(--inactive)",
              },
            ]}
            centreLabel="subscriptions"
            className="sm:flex-col lg:flex-col"
          />
        </Panel>
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card">
        <Toolbar>
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search landlord"
            className="sm:min-w-56 sm:flex-1"
          />

          <Select
            value={status}
            onValueChange={(value) => setStatus(value as SubscriptionStatus | "all")}
          >
            <SelectTrigger className="w-full sm:w-40" aria-label="Subscription status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="EXPIRED">Expired</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
            </SelectContent>
          </Select>

          <Select value={plan} onValueChange={(value) => setPlan(value as PlanName | "all")}>
            <SelectTrigger className="w-full sm:w-36" aria-label="Plan">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All plans</SelectItem>
              {DEMO_PLANS.map((entry) => (
                <SelectItem key={entry.name} value={entry.name}>
                  {entry.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Toolbar>

        {rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Wallet}
              title="No subscriptions match"
              body="Try clearing the search or choosing a different plan."
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Landlord</TableHead>
                    <TableHead>Plan</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Listings</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Expires</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((subscription) => (
                    <TableRow key={subscription.id}>
                      <TableCell className="font-medium text-foreground">
                        {subscription.landlord}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{subscription.plan}</TableCell>
                      <TableCell className="text-right tabular-nums text-foreground">
                        {formatKes(subscription.amount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatNumber(subscription.listings)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(subscription.startedAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDate(subscription.expiresAt)}
                        <span className="block text-caption opacity-80">
                          {formatRelative(subscription.expiresAt)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <SubscriptionStatusBadge status={subscription.status} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((subscription) => (
                <li key={subscription.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-medium text-foreground">
                        {subscription.landlord}
                      </p>
                      <p className="text-caption text-muted-foreground">
                        {subscription.plan} · {formatKes(subscription.amount)} / month
                      </p>
                    </div>
                    <SubscriptionStatusBadge status={subscription.status} />
                  </div>

                  <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-caption">
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Listings</dt>
                      <dd className="text-foreground tabular-nums">
                        {formatNumber(subscription.listings)}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Expires</dt>
                      <dd className="text-foreground">{formatDate(subscription.expiresAt)}</dd>
                    </div>
                  </dl>
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
