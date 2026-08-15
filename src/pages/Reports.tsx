import { useEffect, useMemo, useState } from "react";
import { Download, Flag, ShieldAlert } from "lucide-react";

import { DemoBadge, DemoNotice } from "@/components/app/DemoBadge";
import { PageHeader } from "@/components/app/PageHeader";
import { Pagination } from "@/components/app/Pagination";
import { SearchInput, Toolbar } from "@/components/app/SearchInput";
import { EmptyState } from "@/components/app/States";
import { StatCard } from "@/components/app/StatCard";
import { Pill, ReportStatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
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
import {
  demoReports,
  REPORT_REASON_LABELS,
  type DemoReport,
  type ReportReason,
  type ReportStatus,
} from "@/lib/demo/ops";
import { downloadCsv } from "@/lib/export-csv";
import { formatDate, formatNumber, formatRelative } from "@/lib/format";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

/**
 * Reports — listings flagged by tenants.
 *
 * This screen is fake for a harder reason than most: it is not that the endpoint
 * is unwritten, it is that a tenant has no way to report a listing and there is no
 * table to store one if they did. Nothing here can be made real by wiring a URL.
 *
 * The status changes below are deliberately local-only, and say so. An operator
 * clicking "Mark resolved" changes what this tab shows until they reload, and the
 * dialog copy never implies otherwise — a queue that silently forgets your work is
 * worse than one that admits it cannot save it.
 */

const PAGE_SIZE = 10;

const STATUS_ORDER: ReportStatus[] = ["OPEN", "REVIEWING", "RESOLVED", "DISMISSED"];

export default function Reports() {
  const [rows, setRows] = useState<DemoReport[]>(() => demoReports());
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<ReportStatus | "all">("all");
  const [reason, setReason] = useState<ReportReason | "all">("all");
  const [detail, setDetail] = useState<DemoReport | null>(null);

  const search = useDebouncedValue(searchInput.trim().toLowerCase());

  useEffect(() => {
    setPage(1);
  }, [search, status, reason]);

  const counts = useMemo(() => {
    const base: Record<ReportStatus, number> = {
      OPEN: 0,
      REVIEWING: 0,
      RESOLVED: 0,
      DISMISSED: 0,
    };
    for (const report of rows) base[report.status] += 1;
    return base;
  }, [rows]);

  const filtered = useMemo(
    () =>
      rows
        .filter((report) => {
          if (status !== "all" && report.status !== status) return false;
          if (reason !== "all" && report.reason !== reason) return false;
          if (
            search &&
            !`${report.propertyTitle} ${report.location} ${report.landlord}`
              .toLowerCase()
              .includes(search)
          ) {
            return false;
          }
          return true;
        })
        // Open first, then by age — the order an operator would work through.
        .sort((a, b) => {
          const byStatus = STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status);
          if (byStatus !== 0) return byStatus;
          return b.createdAt.localeCompare(a.createdAt);
        }),
    [rows, status, reason, search],
  );

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  /** Local only. Nothing persists — the copy in the sheet says as much. */
  function setReportStatus(id: string, next: ReportStatus) {
    setRows((current) =>
      current.map((report) => (report.id === id ? { ...report, status: next } : report)),
    );
    setDetail((current) => (current && current.id === id ? { ...current, status: next } : current));
  }

  function exportRows() {
    downloadCsv({
      filename: "reports-sample.csv",
      columns: ["Reference", "Listing", "Location", "Landlord", "Reason", "Status", "Reported"],
      rows: filtered.map((report) => [
        report.id,
        report.propertyTitle,
        report.location,
        report.landlord,
        REPORT_REASON_LABELS[report.reason],
        report.status,
        formatDate(report.createdAt),
      ]),
      scopeNote: "Sample data — tenants cannot report a listing yet and none are stored.",
    });
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Listings flagged by tenants, and what was done about them."
        actions={
          <Button variant="outline" onClick={exportRows}>
            <Download />
            Export
            <DemoBadge feature="export" />
          </Button>
        }
      />

      <DemoNotice feature="reports" className="mb-4" />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Open"
          value={formatNumber(counts.OPEN)}
          note="Not yet picked up"
          icon={ShieldAlert}
          demo="reports"
        />
        <StatCard
          label="Reviewing"
          value={formatNumber(counts.REVIEWING)}
          icon={Flag}
          demo="reports"
        />
        <StatCard label="Resolved" value={formatNumber(counts.RESOLVED)} demo="reports" />
        <StatCard
          label="Dismissed"
          value={formatNumber(counts.DISMISSED)}
          note="No action needed"
          demo="reports"
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

        {pageRows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Flag}
              title="No reports match"
              body="Try clearing the search or choosing a different reason."
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
                    <TableHead className="text-right">Review</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageRows.map((report) => (
                    <TableRow key={report.id}>
                      <TableCell>
                        <span className="block font-medium text-foreground">
                          {report.propertyTitle}
                        </span>
                        <span className="block text-caption text-muted-foreground">
                          {report.location}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{report.landlord}</TableCell>
                      <TableCell>
                        <Pill tone="warning">{REPORT_REASON_LABELS[report.reason]}</Pill>
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
              {pageRows.map((report) => (
                <li key={report.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-body-sm font-medium text-foreground">
                        {report.propertyTitle}
                      </p>
                      <p className="truncate text-caption text-muted-foreground">
                        {report.location} · {report.landlord}
                      </p>
                    </div>
                    <ReportStatusBadge status={report.status} />
                  </div>

                  <p className="mt-2 text-caption text-muted-foreground">{report.note}</p>

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
              total={filtered.length}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </section>

      <ReportSheet
        report={detail}
        onClose={() => setDetail(null)}
        onStatusChange={setReportStatus}
      />
    </>
  );
}

function ReportSheet({
  report,
  onClose,
  onStatusChange,
}: {
  report: DemoReport | null;
  onClose: () => void;
  onStatusChange: (id: string, next: ReportStatus) => void;
}) {
  return (
    <Sheet open={Boolean(report)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Report {report?.id}</SheetTitle>
        </SheetHeader>

        {report ? (
          <div className="space-y-5 px-4 pb-6">
            <div>
              <h3 className="text-h3 text-foreground">{report.propertyTitle}</h3>
              <p className="text-body-sm text-muted-foreground">{report.location}</p>
            </div>

            <div className="flex flex-wrap gap-2">
              <ReportStatusBadge status={report.status} />
              <Pill tone="warning">{REPORT_REASON_LABELS[report.reason]}</Pill>
            </div>

            <dl className="space-y-3 text-body-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Landlord</dt>
                <dd className="text-right text-foreground">{report.landlord}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Reported by</dt>
                <dd className="text-right font-mono text-caption text-foreground">
                  {report.reporter}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-muted-foreground">Reported</dt>
                <dd className="text-right text-foreground">{formatDate(report.createdAt)}</dd>
              </div>
            </dl>

            <div className="rounded-lg border border-border bg-surface p-3">
              <p className="text-caption font-medium text-foreground">What was reported</p>
              <p className="mt-1 text-body-sm text-muted-foreground">{report.note}</p>
            </div>

            <div className="rounded-lg border border-warning/30 bg-warning-soft p-3">
              <p className="text-caption text-warning-strong">
                The buttons below change what this tab shows and nothing else. There is no reports
                table to write to, so the change is gone on reload — and hiding a listing or
                suspending its landlord has to be done from the Properties or Users screen.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {report.status !== "REVIEWING" ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onStatusChange(report.id, "REVIEWING")}
                >
                  Start reviewing
                  <DemoBadge feature="reports" showLabel={false} />
                </Button>
              ) : null}
              {report.status !== "RESOLVED" ? (
                <Button size="sm" onClick={() => onStatusChange(report.id, "RESOLVED")}>
                  Mark resolved
                  <DemoBadge feature="reports" showLabel={false} />
                </Button>
              ) : null}
              {report.status !== "DISMISSED" ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onStatusChange(report.id, "DISMISSED")}
                >
                  Dismiss
                  <DemoBadge feature="reports" showLabel={false} />
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
