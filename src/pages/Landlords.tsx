import { useEffect, useMemo, useState } from "react";
import {
  Check,
  Download,
  Eye,
  FileText,
  Inbox,
  Phone,
  ShieldCheck,
  UserX,
  X,
} from "lucide-react";
import { toast } from "sonner";

import { DemoBadge, DemoNotice } from "@/components/app/DemoBadge";
import { FormError } from "@/components/app/FormError";
import { PageHeader } from "@/components/app/PageHeader";
import { Pagination } from "@/components/app/Pagination";
import { SearchInput, Toolbar } from "@/components/app/SearchInput";
import { EmptyState, ErrorState, Spinner, TableSkeleton } from "@/components/app/States";
import {
  ApprovalBadge,
  DocumentCount,
  DocumentStatusBadge,
  UserStatusBadge,
} from "@/components/app/StatusBadge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { approveLandlord, listLandlords, suspendUser } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { USER_STATUSES, type AdminLandlord, type UserStatus } from "@/lib/api/types";
import { demoDocuments, demoRejections } from "@/lib/demo/ops";
import { downloadCsv } from "@/lib/export-csv";
import { formatDate, formatEnum, formatNumber, formatRelative, initials } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

/**
 * Landlord approval queue.
 *
 * Approval is real: `PATCH /admin/landlords/:id/approve` flips `verified`, which is
 * the gate that lets a landlord publish a listing at all. Everything else the design
 * puts on this screen runs into the schema:
 *
 *  - **Location.** `LandlordProfile` has no county or town, and there is no join
 *    that would give one, so the design's Location column and "All locations" filter
 *    cannot be populated. They are replaced by the business name and a real account
 *    status filter rather than a column of dashes.
 *  - **Documents.** A landlord submits a `nationalId` string; no file is uploaded.
 *    The document counts are samples, and the tab that sorts by them is badged.
 *  - **Rejection.** `verified` is one boolean with no rejected state and nowhere to
 *    store a reason. So the design's ✗ action does not pretend to reject: it offers
 *    the real, reversible power an admin does have over a bad application —
 *    suspending the account, with a reason that is stored and shown back.
 *
 * An "Approved" tab is added to the design's three. `?verified=true` is free, and a
 * queue you cannot look behind makes it impossible to check your own work.
 */

type TabKey = "pending" | "documents" | "approved" | "rejections";
const PAGE_SIZE = 10;

export default function Landlords() {
  const [tab, setTab] = useState<TabKey>("pending");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [accountStatus, setAccountStatus] = useState<UserStatus | "all">("all");
  const [selected, setSelected] = useState<string[]>([]);
  const [detail, setDetail] = useState<AdminLandlord | null>(null);
  const [rejecting, setRejecting] = useState<AdminLandlord | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);
  const [bulkRunning, setBulkRunning] = useState(false);

  const search = useDebouncedValue(searchInput.trim());
  const onList = tab !== "rejections";
  const verified = tab === "approved";

  // Any filter change invalidates the page number — page 4 of a narrowed result set
  // is usually empty, which reads as "nothing to approve".
  useEffect(() => {
    setPage(1);
    setSelected([]);
  }, [tab, search, accountStatus]);

  const { data, error, loading, reload, setData } = useAsync(
    async (signal) => {
      if (!onList) return null;
      return listLandlords({
        page,
        limit: PAGE_SIZE,
        verified,
        status: accountStatus === "all" ? "" : accountStatus,
        search,
        signal,
      });
    },
    [onList, verified, page, search, accountStatus],
  );

  const rows = data?.items ?? [];
  const pagination = data?.pagination;

  /**
   * The documents tab reorders the same pending page so incomplete sets come first,
   * rather than filtering them out — filtering client-side would leave the server's
   * "of 15" contradicting a shorter list, and an operator counting rows would be
   * counting the wrong thing.
   */
  const displayRows = useMemo(() => {
    if (tab !== "documents") return rows;
    return [...rows].sort((a, b) => {
      const left = demoDocuments(a.id);
      const right = demoDocuments(b.id);
      return left.received - left.required - (right.received - right.required);
    });
  }, [rows, tab]);

  const rejections = useMemo(() => demoRejections(), []);

  const selectableIds = tab === "pending" || tab === "documents" ? rows.map((row) => row.id) : [];
  const allSelected = selectableIds.length > 0 && selected.length === selectableIds.length;

  function toggleRow(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  /** Drop the row from the queue it no longer belongs in, and fix the total. */
  function removeRow(id: string) {
    setData((previous) => {
      if (!previous) return null;
      const items = previous.items.filter((item) => item.id !== id);
      const total = Math.max(0, previous.pagination.total - 1);
      return {
        items,
        pagination: {
          ...previous.pagination,
          total,
          totalPages: Math.max(1, Math.ceil(total / (previous.pagination.limit || PAGE_SIZE))),
        },
      };
    });
    setSelected((current) => current.filter((value) => value !== id));
  }

  async function approve(landlord: AdminLandlord) {
    setBusyIds((current) => [...current, landlord.id]);
    try {
      await approveLandlord(landlord.id);
      const name = landlord.businessName || landlord.name || "Landlord";
      if (tab === "approved") {
        toast.success(`${name} is already approved.`);
      } else {
        removeRow(landlord.id);
        toast.success(`${name} approved`, {
          description: "They can publish listings from now on.",
        });
      }
      setDetail((current) =>
        current && current.id === landlord.id ? { ...current, verified: true } : current,
      );
    } catch (caught) {
      toast.error("Couldn't approve this landlord", {
        description: caught instanceof Error ? caught.message : "Please try again.",
      });
    } finally {
      setBusyIds((current) => current.filter((value) => value !== landlord.id));
    }
  }

  /**
   * Bulk approve is a loop, not a batch: there is no bulk endpoint. It runs
   * sequentially so a wide selection can't fire 50 parallel requests into the
   * 300-per-15-minutes limit, and it reports partial failure honestly.
   */
  async function approveSelected() {
    const targets = rows.filter((row) => selected.includes(row.id));
    if (targets.length === 0) return;

    setBulkRunning(true);
    let approved = 0;
    const failures: string[] = [];

    for (const target of targets) {
      try {
        await approveLandlord(target.id);
        approved += 1;
        removeRow(target.id);
      } catch (caught) {
        failures.push(
          `${target.businessName || target.name || target.id}: ${
            caught instanceof Error ? caught.message : "failed"
          }`,
        );
      }
    }

    setBulkRunning(false);
    setSelected([]);

    if (failures.length === 0) {
      toast.success(`${approved} ${approved === 1 ? "landlord" : "landlords"} approved`);
    } else {
      toast.error(`${approved} approved, ${failures.length} failed`, {
        description: failures.slice(0, 3).join(" · "),
      });
    }
  }

  function exportRows() {
    const source = tab === "rejections" ? [] : rows;
    if (tab === "rejections") {
      downloadCsv({
        filename: "landlord-rejections-sample.csv",
        columns: ["Name", "Location", "Reason", "Submitted", "Rejected"],
        rows: rejections.map((row) => [
          row.name,
          row.location,
          row.reason,
          formatDate(row.submittedAt),
          formatDate(row.rejectedAt),
        ]),
        scopeNote: "Sample data — the platform cannot record a rejection.",
      });
      return;
    }

    downloadCsv({
      filename: `landlords-${tab}-page-${page}.csv`,
      columns: [
        "Name",
        "Email",
        "Phone",
        "Business name",
        "National ID",
        "Approved",
        "Account status",
        "Properties",
        "Registered",
      ],
      rows: source.map((row) => [
        row.name,
        row.email,
        row.phone,
        row.businessName,
        row.nationalId,
        row.verified ? "Yes" : "No",
        formatEnum(row.accountStatus),
        row.propertiesCount,
        formatDate(row.createdAt),
      ]),
      scopeNote: pagination
        ? `Page ${page} only — ${source.length} of ${pagination.total} rows. There is no server-side export.`
        : undefined,
    });
  }

  const pendingCount = tab === "pending" || tab === "documents" ? pagination?.total : undefined;

  return (
    <>
      <PageHeader
        title="Landlords"
        description="Approve new landlords so they can publish listings."
        actions={
          <>
            <Button variant="outline" onClick={exportRows}>
              <Download />
              Export
              <DemoBadge feature="export" />
            </Button>
          </>
        }
      />

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)}>
        {/* The tab row scrolls rather than wraps: four labels with counts do not fit
            at 360px, and a wrapped second line pushes the table below the fold. */}
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList className="w-max">
            <TabsTrigger value="pending">
              Pending approval
              {pendingCount !== undefined && tab === "pending" ? ` (${formatNumber(pendingCount)})` : ""}
            </TabsTrigger>
            <TabsTrigger value="documents" className="gap-1.5">
              Documents
              <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
            </TabsTrigger>
            <TabsTrigger value="approved">Approved</TabsTrigger>
            <TabsTrigger value="rejections" className="gap-1.5">
              Rejection history
              <span aria-hidden="true" className="size-1.5 rounded-full bg-warning" />
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>

      {tab === "documents" ? <DemoNotice feature="landlordDocuments" className="mt-4" /> : null}
      {tab === "rejections" ? <DemoNotice feature="rejections" className="mt-4" /> : null}

      <section className="mt-4 rounded-xl border border-border bg-card">
        {tab === "rejections" ? (
          <RejectionHistory rows={rejections} />
        ) : (
          <>
            <Toolbar>
              <SearchInput
                value={searchInput}
                onChange={setSearchInput}
                placeholder="Search name, email or business"
                className="sm:min-w-64 sm:flex-1"
              />

              <Select
                value={accountStatus}
                onValueChange={(value) => setAccountStatus(value as UserStatus | "all")}
              >
                <SelectTrigger className="w-full sm:w-44" aria-label="Account status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All accounts</SelectItem>
                  {USER_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {formatEnum(status)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selected.length > 0 ? (
                <div className="flex items-center gap-2 sm:ml-auto">
                  <Button onClick={approveSelected} disabled={bulkRunning}>
                    {bulkRunning ? <Spinner /> : <Check />}
                    Approve {selected.length}
                  </Button>
                  <DemoBadge feature="bulkActions" />
                </div>
              ) : null}
            </Toolbar>

            {error ? (
              <div className="p-4">
                <ErrorState error={error} onRetry={reload} />
              </div>
            ) : loading && rows.length === 0 ? (
              <TableSkeleton columns={5} />
            ) : displayRows.length === 0 ? (
              <div className="p-4">
                <EmptyState
                  icon={tab === "approved" ? ShieldCheck : Inbox}
                  title={
                    search || accountStatus !== "all"
                      ? "No landlords match those filters"
                      : tab === "approved"
                        ? "No approved landlords yet"
                        : "The queue is empty"
                  }
                  body={
                    search || accountStatus !== "all"
                      ? "Try a different search or clear the account filter."
                      : tab === "approved"
                        ? "Approved landlords will appear here."
                        : "Every landlord who has registered has been reviewed."
                  }
                />
              </div>
            ) : (
              <>
                {/* Table from md up. */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {selectableIds.length > 0 ? (
                          <TableHead className="w-10">
                            <Checkbox
                              checked={allSelected}
                              onCheckedChange={(checked) =>
                                setSelected(checked === true ? selectableIds : [])
                              }
                              aria-label="Select all on this page"
                            />
                          </TableHead>
                        ) : null}
                        <TableHead>Landlord</TableHead>
                        <TableHead>Business</TableHead>
                        <TableHead>Documents</TableHead>
                        <TableHead className="text-right">Properties</TableHead>
                        <TableHead>Registered</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayRows.map((row) => {
                        const documents = demoDocuments(row.id);
                        const busy = busyIds.includes(row.id);

                        return (
                          <TableRow key={row.id}>
                            {selectableIds.length > 0 ? (
                              <TableCell>
                                <Checkbox
                                  checked={selected.includes(row.id)}
                                  onCheckedChange={() => toggleRow(row.id)}
                                  aria-label={`Select ${row.name ?? "landlord"}`}
                                />
                              </TableCell>
                            ) : null}

                            <TableCell>
                              <LandlordIdentity landlord={row} />
                            </TableCell>

                            <TableCell className="text-muted-foreground">
                              {row.businessName || "—"}
                            </TableCell>

                            <TableCell>
                              <DocumentCount
                                received={documents.received}
                                required={documents.required}
                              />
                            </TableCell>

                            <TableCell className="text-right tabular-nums">
                              {formatNumber(row.propertiesCount)}
                            </TableCell>

                            <TableCell className="whitespace-nowrap text-muted-foreground">
                              {formatDate(row.createdAt)}
                            </TableCell>

                            <TableCell>
                              <div className="flex flex-wrap items-center gap-1.5">
                                <ApprovalBadge verified={row.verified} />
                                {row.accountStatus !== "ACTIVE" ? (
                                  <UserStatusBadge status={row.accountStatus} />
                                ) : null}
                              </div>
                            </TableCell>

                            <TableCell>
                              <div className="flex items-center justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDetail(row)}
                                  aria-label={`View ${row.name ?? "landlord"}`}
                                >
                                  <Eye />
                                </Button>
                                {!row.verified ? (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => approve(row)}
                                    disabled={busy}
                                    aria-label={`Approve ${row.name ?? "landlord"}`}
                                    className="text-success-strong hover:bg-success-soft"
                                  >
                                    {busy ? <Spinner /> : <Check />}
                                  </Button>
                                ) : null}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setRejecting(row)}
                                  aria-label={`Reject or suspend ${row.name ?? "landlord"}`}
                                  className="text-destructive-strong hover:bg-destructive-soft"
                                >
                                  <X />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                {/* Cards below md — the same actions, at thumb size. */}
                <ul className="divide-y divide-border md:hidden">
                  {displayRows.map((row) => {
                    const documents = demoDocuments(row.id);
                    const busy = busyIds.includes(row.id);

                    return (
                      <li key={row.id} className="p-4">
                        <div className="flex items-start gap-3">
                          {selectableIds.length > 0 ? (
                            <Checkbox
                              checked={selected.includes(row.id)}
                              onCheckedChange={() => toggleRow(row.id)}
                              aria-label={`Select ${row.name ?? "landlord"}`}
                              className="mt-1"
                            />
                          ) : null}
                          <div className="min-w-0 flex-1">
                            <LandlordIdentity landlord={row} />

                            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                              <ApprovalBadge verified={row.verified} />
                              {row.accountStatus !== "ACTIVE" ? (
                                <UserStatusBadge status={row.accountStatus} />
                              ) : null}
                              <DocumentCount
                                received={documents.received}
                                required={documents.required}
                              />
                            </div>

                            <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-caption">
                              <div className="flex gap-1">
                                <dt className="text-muted-foreground">Business</dt>
                                <dd className="min-w-0 truncate text-foreground">
                                  {row.businessName || "—"}
                                </dd>
                              </div>
                              <div className="flex gap-1">
                                <dt className="text-muted-foreground">Listings</dt>
                                <dd className="text-foreground tabular-nums">
                                  {formatNumber(row.propertiesCount)}
                                </dd>
                              </div>
                              <div className="col-span-2 flex gap-1">
                                <dt className="text-muted-foreground">Registered</dt>
                                <dd className="text-foreground">{formatDate(row.createdAt)}</dd>
                              </div>
                            </dl>

                            <div className="mt-3 flex flex-wrap gap-2">
                              <Button variant="outline" size="sm" onClick={() => setDetail(row)}>
                                <Eye />
                                Details
                              </Button>
                              {!row.verified ? (
                                <Button size="sm" onClick={() => approve(row)} disabled={busy}>
                                  {busy ? <Spinner /> : <Check />}
                                  Approve
                                </Button>
                              ) : null}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setRejecting(row)}
                                className="text-destructive-strong"
                              >
                                <X />
                                Reject
                              </Button>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
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
          </>
        )}
      </section>

      <LandlordDetailSheet
        landlord={detail}
        onClose={() => setDetail(null)}
        onApprove={approve}
        busy={detail ? busyIds.includes(detail.id) : false}
      />

      <RejectDialog
        landlord={rejecting}
        onClose={() => setRejecting(null)}
        onSuspended={(updated) => {
          setData((previous) =>
            previous
              ? {
                  ...previous,
                  items: previous.items.map((item) =>
                    item.userId === updated.userId
                      ? { ...item, accountStatus: updated.status }
                      : item,
                  ),
                }
              : null,
          );
        }}
      />
    </>
  );
}

function LandlordIdentity({ landlord }: { landlord: AdminLandlord }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9 shrink-0">
        {landlord.profilePhoto ? (
          <AvatarImage src={landlord.profilePhoto} alt="" />
        ) : null}
        <AvatarFallback className="bg-secondary text-caption font-semibold text-primary">
          {initials(landlord.businessName || landlord.name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-body-sm font-medium text-foreground">
          {landlord.name || landlord.businessName || "Unnamed landlord"}
        </p>
        <p className="truncate text-caption text-muted-foreground">{landlord.email ?? "—"}</p>
      </div>
    </div>
  );
}

/** Everything the API actually knows about one landlord, plus the sample documents. */
function LandlordDetailSheet({
  landlord,
  onClose,
  onApprove,
  busy,
}: {
  landlord: AdminLandlord | null;
  onClose: () => void;
  onApprove: (landlord: AdminLandlord) => void;
  busy: boolean;
}) {
  const documents = landlord ? demoDocuments(landlord.id) : null;

  return (
    <Sheet open={Boolean(landlord)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Landlord details</SheetTitle>
        </SheetHeader>

        {landlord && documents ? (
          <div className="space-y-6 px-4 pb-8">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                {landlord.profilePhoto ? <AvatarImage src={landlord.profilePhoto} alt="" /> : null}
                <AvatarFallback className="bg-secondary font-semibold text-primary">
                  {initials(landlord.businessName || landlord.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-h3 text-foreground">
                  {landlord.name || landlord.businessName || "Unnamed landlord"}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <ApprovalBadge verified={landlord.verified} />
                  <UserStatusBadge status={landlord.accountStatus} />
                </div>
              </div>
            </div>

            <dl className="space-y-3 text-body-sm">
              <Field label="Email" value={landlord.email} />
              <Field label="Phone" value={landlord.phone} icon={Phone} />
              <Field label="Business name" value={landlord.businessName} />
              <Field label="National ID" value={landlord.nationalId} />
              <Field label="M-Pesa number" value={landlord.mpesaNumber} />
              <Field label="Live listings" value={formatNumber(landlord.propertiesCount)} />
              <Field
                label="Registered"
                value={`${formatDate(landlord.createdAt)} · ${formatRelative(landlord.createdAt)}`}
              />
            </dl>

            <div>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-body-sm font-semibold text-foreground">
                  Verification documents
                </h3>
                <DemoBadge feature="landlordDocuments" />
              </div>
              <ul className="mt-2.5 space-y-2">
                {documents.items.map((item) => (
                  <li
                    key={item.name}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2 text-body-sm text-foreground">
                      <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate">{item.name}</span>
                    </span>
                    <DocumentStatusBadge status={item.status} />
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-caption text-muted-foreground">
                No files are stored on the platform. Approval is a judgement on the details above —
                the national ID number is the only evidence the backend keeps.
              </p>
            </div>

            {!landlord.verified ? (
              <Button className="w-full" onClick={() => onApprove(landlord)} disabled={busy}>
                {busy ? <Spinner /> : <Check />}
                Approve this landlord
              </Button>
            ) : (
              <p className="rounded-lg border border-success/25 bg-success-soft px-3 py-2.5 text-body-sm text-success-strong">
                Approved. This landlord can publish listings.
              </p>
            )}
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: typeof Phone;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2.5 last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-right font-medium break-words text-foreground">
        {Icon && value ? (
          <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        ) : null}
        {value || "—"}
      </dd>
    </div>
  );
}

/**
 * The design's ✗ action, rebuilt around what the API can do.
 *
 * It does not offer a fake rejection. It explains that approval is a one-way
 * boolean, then offers the real alternative: suspend the account with a stored
 * reason, which blocks sign-in and is reversible from the Users screen. The reason
 * is required by the backend and is not a throwaway — it is shown back on the user
 * record.
 */
function RejectDialog({
  landlord,
  onClose,
  onSuspended,
}: {
  landlord: AdminLandlord | null;
  onClose: () => void;
  onSuspended: (updated: { userId: string; status: UserStatus }) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const alreadySuspended = landlord?.accountStatus === "SUSPENDED";

  async function submit() {
    if (!landlord) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(new ApiError(400, "VALIDATION_ERROR", "A reason is required."));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // The **user** id, not the profile id — suspension is an account action.
      const updated = await suspendUser(landlord.userId, trimmed);
      onSuspended({ userId: landlord.userId, status: updated.status });
      toast.success("Account suspended", {
        description: `${landlord.name || landlord.businessName || "This landlord"} can no longer sign in.`,
      });
      close();
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  function close() {
    setReason("");
    setError(null);
    onClose();
  }

  return (
    <Dialog open={Boolean(landlord)} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Reject this application</DialogTitle>
          <DialogDescription>
            A rejection can't be recorded — approval is a single flag with no rejected state and
            nowhere to store a reason. Leaving the landlord unapproved already blocks them from
            publishing.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-border bg-surface px-3 py-2.5">
            <UserX aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-body-sm text-muted-foreground">
              What you <em>can</em> do is suspend the account. That blocks sign-in immediately, ends
              every session they have open, and stores your reason on the record. It is reversible
              from the Users screen.
            </p>
          </div>

          {alreadySuspended ? (
            <p className="rounded-lg border border-destructive/25 bg-destructive-soft px-3 py-2.5 text-body-sm text-destructive-strong">
              This account is already suspended.
            </p>
          ) : (
            <>
              {error ? <FormError error={error} /> : null}
              <div className="space-y-1.5">
                <label htmlFor="suspend-reason" className="text-body-sm font-medium text-foreground">
                  Reason for suspension
                </label>
                <Textarea
                  id="suspend-reason"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows={3}
                  placeholder="e.g. National ID does not match the business permit"
                  disabled={submitting}
                />
                <p className="text-caption text-muted-foreground">
                  Stored on the account and shown to whoever reviews it next. Required.
                </p>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={submitting}>
            {alreadySuspended ? "Close" : "Leave in queue"}
          </Button>
          {!alreadySuspended ? (
            <Button variant="destructive" onClick={submit} disabled={submitting}>
              {submitting ? <Spinner /> : <UserX />}
              Suspend account
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** The design's third tab. Sample rows — see the notice above the table. */
function RejectionHistory({ rows }: { rows: ReturnType<typeof demoRejections> }) {
  return (
    <>
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Applicant</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Reason</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead>Rejected</TableHead>
              <TableHead>By</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell className="font-medium text-foreground">{row.name}</TableCell>
                <TableCell className="text-muted-foreground">{row.location}</TableCell>
                <TableCell className="max-w-xs text-muted-foreground">{row.reason}</TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(row.submittedAt)}
                </TableCell>
                <TableCell className="whitespace-nowrap text-muted-foreground">
                  {formatDate(row.rejectedAt)}
                </TableCell>
                <TableCell className="text-muted-foreground">{row.rejectedBy}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <ul className="divide-y divide-border md:hidden">
        {rows.map((row) => (
          <li key={row.id} className="p-4">
            <p className="text-body-sm font-medium text-foreground">{row.name}</p>
            <p className="text-caption text-muted-foreground">{row.location}</p>
            <p className="mt-2 text-body-sm text-foreground">{row.reason}</p>
            <p className="mt-2 text-caption text-muted-foreground">
              Rejected {formatDate(row.rejectedAt)} by {row.rejectedBy}
            </p>
          </li>
        ))}
      </ul>
    </>
  );
}
