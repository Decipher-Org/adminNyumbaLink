import { useEffect, useState } from "react";
import { ClipboardList, Download } from "lucide-react";

import { PageHeader } from "@/components/app/PageHeader";
import { Pagination } from "@/components/app/Pagination";
import { SearchInput, Toolbar } from "@/components/app/SearchInput";
import { EmptyState, ErrorState, PanelSkeleton } from "@/components/app/States";
import { Pill } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { listAuditLogs } from "@/lib/api/admin";
import type { AdminAuditLog } from "@/lib/api/types";
import { downloadCsv } from "@/lib/export-csv";
import { formatDateTime, formatRelative } from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

const PAGE_SIZE = 20;
const TARGET_TYPES = ["USER", "LANDLORD", "REPORT", "PAYMENT", "JOB"] as const;

function actionLabel(action: string) {
  return action
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export default function AuditLogs() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [targetType, setTargetType] = useState<string>("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [detail, setDetail] = useState<AdminAuditLog | null>(null);
  const search = useDebouncedValue(searchInput.trim());

  useEffect(() => setPage(1), [search, targetType, from, to]);

  const { data, error, loading, reload } = useAsync(
    (signal) =>
      listAuditLogs({
        page,
        limit: PAGE_SIZE,
        search: search || undefined,
        targetType: targetType === "all" ? undefined : targetType,
        from: from ? new Date(`${from}T00:00:00`).toISOString() : undefined,
        to: to ? new Date(`${to}T23:59:59.999`).toISOString() : undefined,
        signal,
      }),
    [page, search, targetType, from, to],
  );

  const rows = data?.items ?? [];
  const pagination = data?.pagination;

  function exportRows() {
    downloadCsv({
      filename: `admin-audit-page-${page}.csv`,
      columns: ["Time", "Administrator", "Action", "Target type", "Target ID", "IP"],
      rows: rows.map((row) => [
        formatDateTime(row.createdAt),
        row.admin.name || row.admin.email,
        row.action,
        row.targetType,
        row.targetId,
        row.ipAddress ?? "",
      ]),
    });
  }

  return (
    <>
      <PageHeader
        title="Audit log"
        description="Durable history of administrative changes and operational actions."
        actions={
          <Button variant="outline" onClick={exportRows} disabled={rows.length === 0}>
            <Download />
            Export page
          </Button>
        }
      />

      <section className="rounded-xl border border-border bg-card">
        <Toolbar>
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search action, target or administrator"
            className="sm:min-w-64 sm:flex-1"
          />
          <Select value={targetType} onValueChange={setTargetType}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Target type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All targets</SelectItem>
              {TARGET_TYPES.map((type) => (
                <SelectItem key={type} value={type}>
                  {actionLabel(type)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
            aria-label="From date"
            className="w-full sm:w-40"
          />
          <Input
            type="date"
            value={to}
            onChange={(event) => setTo(event.target.value)}
            aria-label="To date"
            className="w-full sm:w-40"
          />
        </Toolbar>

        {error ? (
          <div className="p-4"><ErrorState error={error} onRetry={reload} /></div>
        ) : loading && !data ? (
          <div className="p-4"><PanelSkeleton /></div>
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={ClipboardList}
              title="No audit entries match"
              body="Try clearing the search or widening the date range."
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Administrator</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Target</TableHead>
                    <TableHead>When</TableHead>
                    <TableHead className="text-right">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className="block font-medium">{row.admin.name || "Administrator"}</span>
                        <span className="block text-caption text-muted-foreground">{row.admin.email}</span>
                      </TableCell>
                      <TableCell><Pill tone="info">{actionLabel(row.action)}</Pill></TableCell>
                      <TableCell>
                        <span className="block text-body-sm">{actionLabel(row.targetType)}</span>
                        <span className="block max-w-52 truncate font-mono text-caption text-muted-foreground">{row.targetId}</span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">{formatRelative(row.createdAt)}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetail(row)}>Open</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="space-y-2 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-body-sm font-medium">{row.admin.name || row.admin.email}</p>
                      <p className="text-caption text-muted-foreground">{actionLabel(row.targetType)} · {formatRelative(row.createdAt)}</p>
                    </div>
                    <Pill tone="info">{actionLabel(row.action)}</Pill>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setDetail(row)}>View details</Button>
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

      <Sheet open={Boolean(detail)} onOpenChange={(open) => (open ? undefined : setDetail(null))}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader><SheetTitle>Audit entry</SheetTitle></SheetHeader>
          {detail ? (
            <div className="space-y-5 px-4 pb-6 text-body-sm">
              <div className="flex flex-wrap gap-2">
                <Pill tone="info">{actionLabel(detail.action)}</Pill>
                <Pill tone="muted">{actionLabel(detail.targetType)}</Pill>
              </div>
              <dl className="space-y-3">
                <div><dt className="text-muted-foreground">Administrator</dt><dd>{detail.admin.name} · {detail.admin.email}</dd></div>
                <div><dt className="text-muted-foreground">Target</dt><dd className="break-all font-mono text-caption">{detail.targetId}</dd></div>
                <div><dt className="text-muted-foreground">Recorded</dt><dd>{formatDateTime(detail.createdAt)}</dd></div>
                <div><dt className="text-muted-foreground">IP address</dt><dd>{detail.ipAddress ?? "Not recorded"}</dd></div>
              </dl>
              <div>
                <p className="mb-2 text-caption font-medium">Metadata</p>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface p-3 font-mono text-caption">
                  {detail.metadata ? JSON.stringify(detail.metadata, null, 2) : "No metadata recorded."}
                </pre>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </>
  );
}
