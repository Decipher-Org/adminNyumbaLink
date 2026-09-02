import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Download, Flag, ShieldAlert, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

import { PageHeader } from "@/components/app/PageHeader";
import { Pagination } from "@/components/app/Pagination";
import { SearchInput, Toolbar } from "@/components/app/SearchInput";
import { EmptyState, ErrorState, PanelSkeleton } from "@/components/app/States";
import { StatCard } from "@/components/app/StatCard";
import { Pill, ReportStatusBadge, PropertyStatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { fetchPlatformCounts, listReports, resolveReport } from "@/lib/api/admin";
import type {
  AdminReport,
  ReportAction,
  ReportReason,
  ReportStatus,
} from "@/lib/api/types";
import { REPORT_REASON_LABELS } from "@/lib/api/types";
import { downloadCsv } from "@/lib/export-csv";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

const PAGE_SIZE = 10;

export default function Reports() {
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState(() => searchParams.get("search") ?? "");
  const [status, setStatus] = useState<ReportStatus | "all">(() => {
    const value = searchParams.get("status")?.toUpperCase();
    return value && ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"].includes(value)
      ? (value as ReportStatus)
      : "all";
  });
  const [reason, setReason] = useState<ReportReason | "all">(() => {
    const value = searchParams.get("reason")?.toUpperCase();
    return value && Object.hasOwn(REPORT_REASON_LABELS, value)
      ? (value as ReportReason)
      : "all";
  });
  const [detail, setDetail] = useState<AdminReport | null>(null);

  // Resolution modal state
  const [actionModal, setActionModal] = useState<{
    report: AdminReport;
    action: ReportAction;
  } | null>(null);
  const [actionNotes, setActionNotes] = useState("");
  const [actionSubmitting, setActionSubmitting] = useState(false);

  const search = useDebouncedValue(searchInput.trim());

  useEffect(() => {
    setPage(1);
  }, [search, status, reason]);

  const { data, error, loading, reload } = useAsync(
    async (signal) => {
      const [reportsData, countsData] = await Promise.all([
        listReports({
          page,
          limit: PAGE_SIZE,
          status: status === "all" ? undefined : status,
          reason: reason === "all" ? undefined : reason,
          search: search || undefined,
          signal,
        }),
        fetchPlatformCounts(signal),
      ]);
      return { reportsData, countsData };
    },
    [page, status, reason, search],
  );

  const reports = data?.reportsData.items ?? [];
  const pagination = data?.reportsData.pagination;
  const counts = data?.countsData.reports;

  async function handleStartReview(report: AdminReport) {
    try {
      const updated = await resolveReport(report.id, { action: "REVIEWING" });
      toast.success("Report marked as reviewing");
      setDetail(updated);
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update report");
    }
  }

  async function handleConfirmAction() {
    if (!actionModal) return;
    const { report, action } = actionModal;

    if (!actionNotes.trim() && ["PROPERTY_HIDDEN", "DISMISSED", "RESOLVED"].includes(action)) {
      toast.error("Please provide resolution notes");
      return;
    }

    setActionSubmitting(true);
    try {
      const updated = await resolveReport(report.id, {
        action,
        notes: actionNotes.trim(),
      });
      toast.success(
        action === "PROPERTY_HIDDEN"
          ? "Report resolved and property hidden"
          : action === "DISMISSED"
          ? "Report dismissed"
          : "Report resolved",
      );
      setActionModal(null);
      setActionNotes("");
      setDetail(updated);
      reload();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to resolve report");
    } finally {
      setActionSubmitting(false);
    }
  }

  function exportRows() {
    downloadCsv({
      filename: "reports.csv",
      columns: ["Reference", "Listing", "Location", "Landlord", "Reason", "Status", "Reported"],
      rows: reports.map((report) => [
        report.id,
        report.property.title,
        `${report.property.town}, ${report.property.county}`,
        report.property.landlord?.businessName || report.property.landlord?.name || "N/A",
        REPORT_REASON_LABELS[report.reason] || report.reason,
        report.status,
        formatDate(report.createdAt),
      ]),
    });
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Listings flagged by tenants, and operational resolution queue."
        actions={
          <Button variant="outline" onClick={exportRows} disabled={reports.length === 0}>
            <Download />
            Export
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open"
          value={formatNumber(counts?.open ?? 0)}
          note="Not yet picked up"
          icon={ShieldAlert}
        />
        <StatCard
          label="Reviewing"
          value={formatNumber(counts?.reviewing ?? 0)}
          icon={Flag}
        />
        <StatCard
          label="Resolved"
          value={formatNumber(counts?.resolved ?? 0)}
          icon={CheckCircle}
        />
        <StatCard
          label="Dismissed"
          value={formatNumber(counts?.dismissed ?? 0)}
          note="No action needed"
          icon={XCircle}
        />
      </div>

      <section className="mt-4 rounded-xl border border-border bg-card">
        <Toolbar>
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search listing, area or landlord"
            className="sm:min-w-56 sm:flex-1"
          />

          <Select value={status} onValueChange={(value) => setStatus(value as ReportStatus | "all")}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Report status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="OPEN">Open</SelectItem>
              <SelectItem value="REVIEWING">Reviewing</SelectItem>
              <SelectItem value="RESOLVED">Resolved</SelectItem>
              <SelectItem value="DISMISSED">Dismissed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={reason} onValueChange={(value) => setReason(value as ReportReason | "all")}>
            <SelectTrigger className="w-full sm:w-48" aria-label="Report reason">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All reasons</SelectItem>
              {(Object.keys(REPORT_REASON_LABELS) as ReportReason[]).map((key) => (
                <SelectItem key={key} value={key}>
                  {REPORT_REASON_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Toolbar>

        {error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={reload} />
          </div>
        ) : loading && !data ? (
          <div className="p-4">
            <PanelSkeleton />
          </div>
        ) : reports.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Flag}
              title="No reports match"
              body="Try clearing the search or choosing a different filter."
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Listing</TableHead>
                    <TableHead>Landlord</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Reported</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reports.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <span className="block font-medium text-foreground">
                          {report.property.title}
                        </span>
                        <span className="block text-caption text-muted-foreground">
                          {report.property.town}, {report.property.county}
                          {report.property.estate ? ` · ${report.property.estate}` : ""}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {report.property.landlord?.businessName ||
                          report.property.landlord?.name ||
                          "N/A"}
                      </TableCell>
                      <TableCell>
                        <Pill tone="warning">{REPORT_REASON_LABELS[report.reason] || report.reason}</Pill>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatRelative(report.createdAt)}
                      </TableCell>
                      <TableCell>
                        <ReportStatusBadge status={report.status} />
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(report)}>
                          Open
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {reports.map((report) => (
                <li key={report.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-medium text-foreground">
                        {report.property.title}
                      </p>
                      <p className="truncate text-caption text-muted-foreground">
                        {report.property.town}, {report.property.county} ·{" "}
                        {report.property.landlord?.businessName || report.property.landlord?.name || "N/A"}
                      </p>
                    </div>
                    <ReportStatusBadge status={report.status} />
                  </div>

                  {report.description ? (
                    <p className="mt-2 text-caption text-muted-foreground line-clamp-2">
                      {report.description}
                    </p>
                  ) : null}

                  <div className="mt-2.5 flex items-center justify-between gap-3">
                    <span className="text-caption text-muted-foreground">
                      {formatRelative(report.createdAt)}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => setDetail(report)}>
                      Open
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={page}
              limit={PAGE_SIZE}
              total={pagination?.total ?? 0}
              totalPages={pagination?.totalPages ?? 1}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      {/* Report Detail Sheet */}
      <Sheet open={Boolean(detail)} onOpenChange={(open) => (open ? undefined : setDetail(null))}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Report {detail?.id}</SheetTitle>
          </SheetHeader>

          {detail ? (
            <div className="space-y-5 px-4 pb-6">
              <div>
                <h3 className="text-h3 text-foreground">{detail.property.title}</h3>
                <p className="text-body-sm text-muted-foreground">
                  {detail.property.town}, {detail.property.county}
                  {detail.property.estate ? ` · ${detail.property.estate}` : ""}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ReportStatusBadge status={detail.status} />
                <PropertyStatusBadge status={detail.property.status} />
                <Pill tone="warning">{REPORT_REASON_LABELS[detail.reason] || detail.reason}</Pill>
              </div>

              <dl className="space-y-3 text-body-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Landlord</dt>
                  <dd className="text-right text-foreground">
                    {detail.property.landlord?.businessName || detail.property.landlord?.name || "N/A"}
                    {detail.property.landlord?.verified ? " (Verified)" : " (Unverified)"}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Reported by</dt>
                  <dd className="text-right text-foreground">
                    {detail.reporter.name} ({detail.reporter.email})
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-muted-foreground">Reported</dt>
                  <dd className="text-right text-foreground">{formatDate(detail.createdAt)}</dd>
                </div>
              </dl>

              <div className="rounded-lg border border-border bg-surface p-3">
                <p className="text-caption font-medium text-foreground">What was reported</p>
                <p className="mt-1 text-body-sm text-muted-foreground">
                  {detail.description || "No detailed description provided by tenant."}
                </p>
              </div>

              {detail.resolvedAt ? (
                <div className="rounded-lg border border-border bg-surface p-3 space-y-2">
                  <p className="text-caption font-medium text-foreground">Resolution History</p>
                  <div className="text-caption text-muted-foreground space-y-1">
                    <p>
                      <span className="font-medium">Action:</span> {detail.action}
                    </p>
                    {detail.notes ? (
                      <p>
                        <span className="font-medium">Notes:</span> {detail.notes}
                      </p>
                    ) : null}
                    <p>
                      <span className="font-medium">Resolved by:</span>{" "}
                      {detail.resolvedBy?.name || detail.resolvedBy?.email || "Admin"}
                    </p>
                    <p>
                      <span className="font-medium">Resolved at:</span>{" "}
                      {formatDate(detail.resolvedAt)}
                    </p>
                  </div>
                </div>
              ) : null}

              {/* Actions */}
              {detail.status !== "RESOLVED" && detail.status !== "DISMISSED" ? (
                <div className="space-y-3 pt-2">
                  <p className="text-caption font-medium text-muted-foreground">Available Actions</p>
                  <div className="flex flex-wrap gap-2">
                    {detail.status === "OPEN" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartReview(detail)}
                      >
                        Start reviewing
                      </Button>
                    ) : null}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setActionModal({ report: detail, action: "PROPERTY_HIDDEN" })}
                    >
                      Resolve & Hide Listing
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setActionModal({ report: detail, action: "RESOLVED" })}
                    >
                      Resolve (Keep Listing)
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setActionModal({ report: detail, action: "DISMISSED" })}
                    >
                      Dismiss
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Confirmation & Notes Dialog */}
      <Dialog
        open={Boolean(actionModal)}
        onOpenChange={(open) => {
          if (!open) {
            setActionModal(null);
            setActionNotes("");
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {actionModal?.action === "PROPERTY_HIDDEN" ? (
                <>
                  <AlertTriangle className="size-5 text-destructive" />
                  Hide Listing & Resolve Report
                </>
              ) : actionModal?.action === "DISMISSED" ? (
                <>
                  <XCircle className="size-5 text-muted-foreground" />
                  Dismiss Report
                </>
              ) : (
                <>
                  <CheckCircle className="size-5 text-success-strong" />
                  Resolve Report
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {actionModal?.action === "PROPERTY_HIDDEN"
                ? `Are you sure you want to hide "${actionModal.report.property.title}"? The property will immediately be removed from tenant searches and listings.`
                : actionModal?.action === "DISMISSED"
                ? `Dismiss report on "${actionModal?.report.property.title}". The listing will remain live without changes.`
                : `Resolve report on "${actionModal?.report.property.title}" without hiding the property.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <label htmlFor="action-notes" className="text-body-sm font-medium text-foreground">
              Resolution notes (required)
            </label>
            <Textarea
              id="action-notes"
              placeholder="Explain reason for this resolution action (required for audit log)..."
              value={actionNotes}
              onChange={(e) => setActionNotes(e.target.value)}
              rows={4}
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setActionModal(null);
                setActionNotes("");
              }}
              disabled={actionSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant={actionModal?.action === "PROPERTY_HIDDEN" ? "destructive" : "default"}
              onClick={handleConfirmAction}
              disabled={actionSubmitting || !actionNotes.trim()}
            >
              {actionSubmitting
                ? "Processing..."
                : actionModal?.action === "PROPERTY_HIDDEN"
                ? "Confirm & Hide Listing"
                : actionModal?.action === "DISMISSED"
                ? "Confirm Dismissal"
                : "Confirm Resolution"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
