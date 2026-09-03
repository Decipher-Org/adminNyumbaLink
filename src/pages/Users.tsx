import { useEffect, useState, type ReactNode } from "react";
import {
  BadgeCheck,
  Download,
  Eye,
  Mail,
  Phone,
  RotateCcw,
  ShieldAlert,
  UserCog,
  UserX,
  Users as UsersIcon,
} from "lucide-react";
import { toast } from "sonner";

import { FormError } from "@/components/app/FormError";
import { PageHeader } from "@/components/app/PageHeader";
import { Pagination } from "@/components/app/Pagination";
import { SearchInput, Toolbar } from "@/components/app/SearchInput";
import { EmptyState, ErrorState, Spinner, TableSkeleton } from "@/components/app/States";
import { Pill, RoleBadge, UserStatusBadge } from "@/components/app/StatusBadge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { changeUserRole, listUsers, reinstateUser, suspendUser } from "@/lib/api/admin";
import { ApiError } from "@/lib/api/client";
import { ROLES, USER_STATUSES, type AdminUser, type Role, type UserStatus } from "@/lib/api/types";
import { useAuth } from "@/lib/auth/AuthProvider";
import { downloadCsv } from "@/lib/export-csv";
import {
  formatDate,
  formatDateTime,
  formatEnum,
  formatNumber,
  formatRelative,
  initials,
} from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";

/**
 * Users Management.
 *
 * This is the most powerful screen in the console and almost all of it is real:
 * `GET /admin/users` with role, status and search filters, plus three mutations
 * that take effect immediately — role change, suspend and reinstate.
 *
 * Two departures from the mockup, both forced by the schema:
 *
 *  - **Location** is not stored on a user. There is no county, town or address
 *    column on the account, so the column shows the phone number instead — real,
 *    and the thing an operator actually needs when following up.
 *  - **All Roles** would duplicate the tab row, which already filters by role. The
 *    dropdown filters by *account status* instead, which is a real query parameter
 *    and is otherwise unreachable.
 *
 * The three mutations all carry consequences the API gives no undo for, so each
 * one states them before the click: a role change signs the target out of every
 * device, a suspension needs a reason that is stored on the record, and a
 * deactivated account cannot be reinstated by an admin at all.
 */

type TabKey = "all" | "TENANT" | "LANDLORD" | "ADMIN";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All users" },
  { key: "TENANT", label: "Tenants" },
  { key: "LANDLORD", label: "Landlords" },
  { key: "ADMIN", label: "Admins" },
];

const PAGE_SIZE = 10;

export default function Users() {
  const { user: currentUser } = useAuth();

  const [tab, setTab] = useState<TabKey>("all");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<UserStatus | "all">("all");
  const [detail, setDetail] = useState<AdminUser | null>(null);
  const [roleTarget, setRoleTarget] = useState<AdminUser | null>(null);
  const [suspendTarget, setSuspendTarget] = useState<AdminUser | null>(null);
  const [busyIds, setBusyIds] = useState<string[]>([]);

  const search = useDebouncedValue(searchInput.trim());

  useEffect(() => {
    setPage(1);
  }, [tab, search, status]);

  const { data, error, loading, reload, setData } = useAsync(
    (signal) =>
      listUsers({
        page,
        limit: PAGE_SIZE,
        role: tab === "all" ? "" : tab,
        status: status === "all" ? "" : status,
        search,
        signal,
      }),
    [tab, page, status, search],
  );

  const rows = data?.items ?? [];
  const pagination = data?.pagination;

  /** Patch one row from a mutation's own response — no refetch, no flicker. */
  function patchRow(updated: AdminUser) {
    setData((previous) =>
      previous
        ? {
            ...previous,
            items: previous.items.map((item) => (item.id === updated.id ? updated : item)),
          }
        : undefined,
    );
    setDetail((current) => (current && current.id === updated.id ? updated : current));
  }

  async function reinstate(target: AdminUser) {
    setBusyIds((current) => [...current, target.id]);
    try {
      const updated = await reinstateUser(target.id);
      patchRow(updated);
      toast.success(`${target.name || target.email} can sign in again`);
    } catch (caught) {
      toast.error("Couldn't lift the suspension", {
        description: caught instanceof Error ? caught.message : "Please try again.",
      });
    } finally {
      setBusyIds((current) => current.filter((value) => value !== target.id));
    }
  }

  function exportRows() {
    downloadCsv({
      filename: `users-${tab.toLowerCase()}-page-${page}.csv`,
      columns: [
        "Name",
        "Email",
        "Phone",
        "Role",
        "Status",
        "Email verified",
        "Suspended on",
        "Suspension reason",
        "Joined",
      ],
      rows: rows.map((row) => [
        row.name,
        row.email,
        row.phone,
        formatEnum(row.role),
        formatEnum(row.status),
        row.isVerified ? "Yes" : "No",
        row.suspendedAt ? formatDate(row.suspendedAt) : "",
        row.suspendedReason ?? "",
        formatDate(row.createdAt),
      ]),
      scopeNote: pagination
        ? `Page ${page} only — ${rows.length} of ${pagination.total} accounts. There is no server-side export.`
        : undefined,
    });
  }

  const filtered = search.length > 0 || status !== "all";

  return (
    <>
      <PageHeader
        title="Users"
        description="Every account on the platform, with the roles and suspensions an admin controls."
        actions={
          <>
            <Button variant="outline" onClick={exportRows}>
              <Download />
              Export
            </Button>
          </>
        }
      />

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

      <section className="mt-4 rounded-xl border border-border bg-card">
        <Toolbar>
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search name or email"
            className="sm:min-w-64 sm:flex-1"
          />

          <Select value={status} onValueChange={(value) => setStatus(value as UserStatus | "all")}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Account status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {USER_STATUSES.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {formatEnum(entry)}
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
          <TableSkeleton columns={5} />
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={UsersIcon}
              title={filtered ? "No accounts match those filters" : "No accounts yet"}
              body={
                filtered
                  ? "Try a different search, or clear the status filter."
                  : "Accounts appear here as people sign up in the main app."
              }
            />
          </div>
        ) : (
          <>
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined on</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => {
                    const isSelf = row.id === currentUser?.id;
                    const busy = busyIds.includes(row.id);

                    return (
                      <TableRow key={row.id}>
                        <TableCell>
                          <UserIdentity user={row} isSelf={isSelf} />
                        </TableCell>
                        <TableCell>
                          <RoleBadge role={row.role} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {row.phone || "—"}
                        </TableCell>
                        <TableCell>
                          <UserStatusBadge status={row.status} />
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-muted-foreground">
                          {formatDate(row.createdAt)}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setDetail(row)}
                              aria-label={`View ${row.name || row.email}`}
                            >
                              <Eye />
                            </Button>

                            <SelfAware disabled={isSelf} reason="You can't change your own role.">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setRoleTarget(row)}
                                disabled={isSelf}
                                aria-label={`Change role for ${row.name || row.email}`}
                              >
                                <UserCog />
                              </Button>
                            </SelfAware>

                            {row.status === "SUSPENDED" ? (
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => reinstate(row)}
                                disabled={busy}
                                aria-label={`Reinstate ${row.name || row.email}`}
                                className="text-success-strong hover:bg-success-soft"
                              >
                                {busy ? <Spinner /> : <RotateCcw />}
                              </Button>
                            ) : row.status === "ACTIVE" ? (
                              <SelfAware
                                disabled={isSelf}
                                reason="You can't suspend your own account."
                              >
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setSuspendTarget(row)}
                                  disabled={isSelf}
                                  aria-label={`Suspend ${row.name || row.email}`}
                                  className="text-destructive-strong hover:bg-destructive-soft"
                                >
                                  <UserX />
                                </Button>
                              </SelfAware>
                            ) : (
                              <SelfAware
                                disabled
                                reason="This person closed their own account. An admin can't reopen it."
                              >
                                <Button variant="ghost" size="icon" disabled aria-label="Closed account">
                                  <ShieldAlert />
                                </Button>
                              </SelfAware>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((row) => {
                const isSelf = row.id === currentUser?.id;
                const busy = busyIds.includes(row.id);

                return (
                  <li key={row.id} className="p-4">
                    <UserIdentity user={row} isSelf={isSelf} />

                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      <RoleBadge role={row.role} />
                      <UserStatusBadge status={row.status} />
                      {row.isVerified ? null : <Pill tone="warning">Email unverified</Pill>}
                    </div>

                    <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-caption">
                      <div className="flex gap-1">
                        <dt className="text-muted-foreground">Phone</dt>
                        <dd className="min-w-0 truncate text-foreground">{row.phone || "—"}</dd>
                      </div>
                      <div className="flex gap-1">
                        <dt className="text-muted-foreground">Joined</dt>
                        <dd className="text-foreground">{formatDate(row.createdAt)}</dd>
                      </div>
                    </dl>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button variant="outline" size="sm" onClick={() => setDetail(row)}>
                        <Eye />
                        Details
                      </Button>
                      {!isSelf ? (
                        <Button variant="outline" size="sm" onClick={() => setRoleTarget(row)}>
                          <UserCog />
                          Role
                        </Button>
                      ) : null}
                      {row.status === "SUSPENDED" ? (
                        <Button size="sm" onClick={() => reinstate(row)} disabled={busy}>
                          {busy ? <Spinner /> : <RotateCcw />}
                          Reinstate
                        </Button>
                      ) : row.status === "ACTIVE" && !isSelf ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSuspendTarget(row)}
                          className="text-destructive-strong"
                        >
                          <UserX />
                          Suspend
                        </Button>
                      ) : null}
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
      </section>

      <UserDetailSheet
        user={detail}
        isSelf={detail?.id === currentUser?.id}
        onClose={() => setDetail(null)}
      />

      <RoleDialog
        user={roleTarget}
        onClose={() => setRoleTarget(null)}
        onChanged={(updated) => {
          patchRow(updated);
          toast.success(`${updated.name || updated.email} is now a ${formatEnum(updated.role)}`, {
            description: "They have been signed out of every device.",
          });
        }}
      />

      <SuspendDialog
        user={suspendTarget}
        onClose={() => setSuspendTarget(null)}
        onSuspended={(updated) => {
          patchRow(updated);
          toast.success(`${updated.name || updated.email} is suspended`, {
            description: "They can no longer sign in, on any device.",
          });
        }}
      />

    </>
  );
}

function UserIdentity({ user, isSelf }: { user: AdminUser; isSelf: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className="bg-secondary text-caption font-semibold text-primary">
          {initials(user.name || user.email)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 truncate text-body-sm font-medium text-foreground">
          <span className="truncate">{user.name || "Unnamed account"}</span>
          {isSelf ? (
            <span className="shrink-0 rounded bg-secondary px-1.5 py-0.5 text-[11px] leading-none font-semibold text-primary">
              You
            </span>
          ) : null}
          {user.isVerified ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <BadgeCheck
                  aria-label="Email verified"
                  className="size-3.5 shrink-0 text-success-strong"
                />
              </TooltipTrigger>
              <TooltipContent>Email verified</TooltipContent>
            </Tooltip>
          ) : null}
        </p>
        <p className="truncate text-caption text-muted-foreground">{user.email}</p>
      </div>
    </div>
  );
}

/**
 * Wraps a disabled icon button so the reason survives.
 *
 * A disabled button swallows its own pointer events, and a bare greyed-out icon
 * leaves an operator guessing whether the platform is broken or whether they are
 * being told no. The tooltip sits on a wrapper span, which still receives hover
 * and focus.
 */
function SelfAware({
  disabled,
  reason,
  children,
}: {
  disabled: boolean;
  reason: string;
  children: ReactNode;
}) {
  if (!disabled) return <>{children}</>;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex rounded-lg">
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  );
}

/** Everything `toAdminUser` returns, including the fields only an admin may see. */
function UserDetailSheet({
  user,
  isSelf,
  onClose,
}: {
  user: AdminUser | null;
  isSelf: boolean;
  onClose: () => void;
}) {
  return (
    <Sheet open={Boolean(user)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Account details</SheetTitle>
        </SheetHeader>

        {user ? (
          <div className="space-y-6 px-4 pb-8">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback className="bg-secondary font-semibold text-primary">
                  {initials(user.name || user.email)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate text-h3 text-foreground">
                  {user.name || "Unnamed account"}
                  {isSelf ? " (you)" : ""}
                </p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <RoleBadge role={user.role} />
                  <UserStatusBadge status={user.status} />
                </div>
              </div>
            </div>

            {user.status === "SUSPENDED" ? (
              <div className="rounded-lg border border-destructive/25 bg-destructive-soft px-3 py-2.5 text-body-sm text-destructive-strong">
                <p className="font-semibold">
                  Suspended {user.suspendedAt ? formatRelative(user.suspendedAt) : ""}
                </p>
                <p className="mt-0.5">{user.suspendedReason || "No reason was recorded."}</p>
              </div>
            ) : null}

            {user.status === "DEACTIVATED" ? (
              <div className="rounded-lg border border-border bg-surface px-3 py-2.5 text-body-sm text-muted-foreground">
                This person closed their own account. An admin cannot reopen it — they have to sign
                up again.
              </div>
            ) : null}

            <dl className="space-y-3 text-body-sm">
              <DetailRow label="Email" value={user.email} icon={Mail} />
              <DetailRow
                label="Email verified"
                value={user.isVerified ? "Yes" : "No — they can't sign in yet"}
              />
              <DetailRow label="Phone" value={user.phone} icon={Phone} />
              <DetailRow
                label="Phone verified"
                value={user.phone ? (user.phoneVerified ? "Yes" : "No") : "No number on file"}
              />
              <DetailRow
                label="Joined"
                value={`${formatDateTime(user.createdAt)} · ${formatRelative(user.createdAt)}`}
              />
              <DetailRow label="Last updated" value={formatDateTime(user.updatedAt)} />
              <DetailRow label="Account ID" value={user.id} />
            </dl>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | null | undefined;
  icon?: typeof Mail;
}) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2.5 last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center gap-1.5 text-right font-medium break-all text-foreground">
        {Icon && value ? (
          <Icon aria-hidden="true" className="size-3.5 shrink-0 text-muted-foreground" />
        ) : null}
        {value || "—"}
      </dd>
    </div>
  );
}

/**
 * Role change.
 *
 * Two things the backend does that the operator has to know first: it signs the
 * target out everywhere, and granting LANDLORD does **not** create a landlord
 * profile or approve them — they still have to submit their details and be
 * approved in the queue. Demoting a landlord leaves their properties in place.
 */
function RoleDialog({
  user,
  onClose,
  onChanged,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onChanged: (updated: AdminUser) => void;
}) {
  const [role, setRole] = useState<Role | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  // The select starts on the role the account already has, each time it opens.
  const selected = role ?? user?.role ?? "TENANT";
  const unchanged = user ? selected === user.role : true;

  function close() {
    setRole(null);
    setError(null);
    onClose();
  }

  async function submit() {
    if (!user || unchanged) return;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await changeUserRole(user.id, selected);
      onChanged(updated);
      close();
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Change role</DialogTitle>
          <DialogDescription>
            {user ? `${user.name || user.email} is currently a ${formatEnum(user.role)}.` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? <FormError error={error} /> : null}

          <div className="space-y-1.5">
            <label htmlFor="new-role" className="text-body-sm font-medium text-foreground">
              New role
            </label>
            <Select value={selected} onValueChange={(value) => setRole(value as Role)}>
              <SelectTrigger id="new-role" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((entry) => (
                  <SelectItem key={entry} value={entry}>
                    {formatEnum(entry)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <ul className="space-y-1.5 text-caption text-muted-foreground">
            <li>· Saving signs this person out of every device immediately.</li>
            <li>
              · Making someone a landlord doesn't approve them — they still submit their details and
              wait in the approval queue.
            </li>
            <li>· Demoting a landlord keeps their listings; they reappear if the role comes back.</li>
            {selected === "ADMIN" ? (
              <li className="font-medium text-warning-strong">
                · An admin can suspend accounts and change roles, including promoting other admins.
              </li>
            ) : null}
          </ul>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || unchanged}>
            {submitting ? <Spinner /> : <UserCog />}
            Save role
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Suspension. The reason is required by the backend and stored on the record. */
function SuspendDialog({
  user,
  onClose,
  onSuspended,
}: {
  user: AdminUser | null;
  onClose: () => void;
  onSuspended: (updated: AdminUser) => void;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<unknown>(null);

  function close() {
    setReason("");
    setError(null);
    onClose();
  }

  async function submit() {
    if (!user) return;
    const trimmed = reason.trim();
    if (!trimmed) {
      setError(new ApiError(400, "VALIDATION_ERROR", "A reason is required."));
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const updated = await suspendUser(user.id, trimmed);
      onSuspended(updated);
      close();
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={Boolean(user)} onOpenChange={(open) => (open ? undefined : close())}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Suspend this account</DialogTitle>
          <DialogDescription>
            {user
              ? `${user.name || user.email} will be signed out everywhere and blocked from signing in. You can lift it again from this screen.`
              : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error ? <FormError error={error} /> : null}

          {user?.role === "LANDLORD" ? (
            <p className="rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-body-sm text-warning-strong">
              This is a landlord. Their listings stay published — suspending blocks the account, not
              the properties.
            </p>
          ) : null}

          <div className="space-y-1.5">
            <label htmlFor="reason" className="text-body-sm font-medium text-foreground">
              Reason
            </label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={3}
              placeholder="e.g. Repeated fake listings after two warnings"
              disabled={submitting}
            />
            <p className="text-caption text-muted-foreground">
              Stored on the account and shown to whoever reviews it next. Required.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={close} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={submit} disabled={submitting}>
            {submitting ? <Spinner /> : <UserX />}
            Suspend account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
