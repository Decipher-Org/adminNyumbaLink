import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Building2,
  Download,
  Eye,
  Filter,
  ImageOff,
  MapPin,
  Plus,
  SlidersHorizontal,
  X,
} from "lucide-react";

import { DemoBadge, DemoNotice, DemoRowMark } from "@/components/app/DemoBadge";
import { PageHeader } from "@/components/app/PageHeader";
import { Pagination } from "@/components/app/Pagination";
import { SearchInput, Toolbar } from "@/components/app/SearchInput";
import { EmptyState, ErrorState, Spinner, TableSkeleton } from "@/components/app/States";
import { Pill, PropertyStatusBadge } from "@/components/app/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getProperty, searchPropertiesWithLandlord } from "@/lib/api/properties";
import { PROPERTY_STATUSES, type PropertyStatus } from "@/lib/api/types";
import { demoNonLiveProperties, demoPropertyViews } from "@/lib/demo/ops";
import { downloadCsv } from "@/lib/export-csv";
import {
  formatCompact,
  formatDate,
  formatKes,
  formatLocation,
  formatNumber,
} from "@/lib/format";
import { useAsync } from "@/lib/hooks/use-async";
import { useDebouncedValue } from "@/lib/hooks/use-debounced-value";
import { COASTAL_COUNTIES } from "@/lib/locations";

/**
 * Properties Management.
 *
 * The awkward screen, and worth reading the whole comment before changing it.
 *
 * `GET /properties` is the public catalogue. It branches on role, and an admin
 * lands in the `else` branch where `status = "ACTIVE"` is hardcoded — so **the API
 * cannot show an admin a draft, hidden or archived listing**, with any filter or
 * flag. There is no admin properties endpoint yet either. What this screen does
 * about that:
 *
 *  - **Live listings are real**, and use the Milestone 6 `/search` endpoint for
 *    keyword, county/town/rent/bedroom filtering across the catalogue.
 *  - **The landlord column is real**, fetched per row from the detail endpoint,
 *    because the list serialiser has no landlord field. Bounded to the visible page.
 *  - **Non-live rows are samples**, marked individually in the table, and the
 *    status filter says as much. They only appear on page one, so paging through
 *    the real catalogue doesn't repeat them.
 *  - **Views are samples** — nothing increments a view counter yet.
 */

type StatusFilter = PropertyStatus | "all";

type PropertyRow = {
  id: string;
  title: string;
  county: string;
  town: string;
  estate: string | null;
  status: PropertyStatus;
  image: string | null;
  landlordName: string | null;
  rentFrom: number | null;
  totalUnits: number | null;
  availableUnits: number | null;
  views: number;
  createdAt: string;
  /** True for a row that does not exist in the database. */
  demo: boolean;
};

type ServerFilters = {
  county: string;
  town: string;
  estate: string;
  minPrice: string;
  maxPrice: string;
  bedrooms: string;
};

const EMPTY_FILTERS: ServerFilters = {
  county: "",
  town: "",
  estate: "",
  minPrice: "",
  maxPrice: "",
  bedrooms: "",
};

const PAGE_SIZE = 10;

export default function Properties() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [filters, setFilters] = useState<ServerFilters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [detail, setDetail] = useState<PropertyRow | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const search = useDebouncedValue(searchInput.trim());

  // Live rows are only worth fetching when the filter could include them.
  const wantsLive = status === "all" || status === "ACTIVE";

  useEffect(() => {
    setPage(1);
  }, [status, filters]);

  const { data, error, loading, reload } = useAsync(
    async (signal) => {
      if (!wantsLive) return null;
      return searchPropertiesWithLandlord({
        page,
        limit: PAGE_SIZE,
        q: search || undefined,
        county: filters.county.trim(),
        town: filters.town.trim(),
        estate: filters.estate.trim(),
        minPrice: numberOrUndefined(filters.minPrice),
        maxPrice: numberOrUndefined(filters.maxPrice),
        bedrooms: filters.bedrooms.trim(),
        signal,
      });
    },
    [wantsLive, page, filters, search],
  );

  const liveRows = useMemo<PropertyRow[]>(
    () =>
      (data?.items ?? []).map((item) => ({
        id: item.id,
        title: item.title,
        county: item.county,
        town: item.town,
        estate: item.estate,
        status: item.status,
        image: item.images?.[0] ?? null,
        landlordName: item.landlord?.businessName ?? null,
        rentFrom: item.unitsFrom,
        totalUnits: item.totalUnits,
        availableUnits: item.availableUnits,
        views: demoPropertyViews(item.id),
        createdAt: item.createdAt,
        demo: false,
      })),
    [data],
  );

  /**
   * Sample rows for the statuses the API withholds. Page one only — they are not
   * part of the server's pagination, so repeating them on page two would inflate
   * every page by six.
   */
  const demoRows = useMemo<PropertyRow[]>(() => {
    if (status === "ACTIVE") return [];
    if (wantsLive && page !== 1) return [];

    return demoNonLiveProperties()
      .filter((row) => status === "all" || row.status === status)
      .map((row) => ({
        id: row.id,
        title: row.title,
        county: row.county,
        town: row.town,
        estate: row.estate,
        status: row.status,
        image: null,
        landlordName: row.landlordName,
        rentFrom: row.unitsFrom,
        totalUnits: null,
        availableUnits: null,
        views: row.views,
        createdAt: row.createdAt,
        demo: true,
      }));
  }, [status, wantsLive, page]);

  const rows = useMemo(() => [...liveRows, ...demoRows], [liveRows, demoRows]);

  const pagination = data?.pagination;
  const activeFilterCount = Object.values(filters).filter((value) => value.trim() !== "").length;

  function exportRows() {
    downloadCsv({
      filename: `properties-page-${page}.csv`,
      columns: [
        "Title",
        "Landlord",
        "County",
        "Town",
        "Estate",
        "Status",
        "Rent from (KES)",
        "Units",
        "Available",
        "Created",
        "Sample row",
      ],
      rows: rows.map((row) => [
        row.title,
        row.landlordName ?? "",
        row.county,
        row.town,
        row.estate ?? "",
        row.status,
        row.rentFrom ?? "",
        row.totalUnits ?? "",
        row.availableUnits ?? "",
        formatDate(row.createdAt),
        row.demo ? "yes" : "no",
      ]),
      scopeNote: pagination
        ? `Page ${page} of live listings (${pagination.total} total) plus sample non-live rows. View counts are omitted because they are not measured.`
        : "Sample non-live rows only — the API does not return these statuses to an admin.",
    });
  }

  return (
    <>
      <PageHeader
        title="Properties"
        description="Every live listing on the platform, with its landlord and location."
        actions={
          <>
            <Button variant="outline" onClick={exportRows}>
              <Download />
              Export
              <DemoBadge feature="export" />
            </Button>
            <Button onClick={() => setAddOpen(true)}>
              <Plus />
              Add property
              <DemoBadge feature="createProperty" />
            </Button>
          </>
        }
      />

      {status !== "ACTIVE" ? <DemoNotice feature="propertyStatusFilter" className="mb-4" /> : null}

      <section className="rounded-xl border border-border bg-card">
        <Toolbar>
          <SearchInput
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Search live listings by title or area"
            className="sm:min-w-64 sm:flex-1"
          />

          <Select value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
            <SelectTrigger className="w-full sm:w-40" aria-label="Listing status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {PROPERTY_STATUSES.map((entry) => (
                <SelectItem key={entry} value={entry}>
                  {entry === "ACTIVE" ? "Active (live)" : `${titleCase(entry)} (sample)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button variant="outline" onClick={() => setFiltersOpen(true)} className="w-full sm:w-auto">
            <SlidersHorizontal />
            Filters
            {activeFilterCount > 0 ? (
              <span className="ml-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[11px] leading-none font-semibold text-primary-foreground">
                {activeFilterCount}
              </span>
            ) : null}
          </Button>

        </Toolbar>

        {activeFilterCount > 0 ? (
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
            {(Object.entries(filters) as [keyof ServerFilters, string][])
              .filter(([, value]) => value.trim() !== "")
              .map(([key, value]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilters((current) => ({ ...current, [key]: "" }))}
                  className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-caption font-medium text-primary transition-colors hover:bg-secondary/70"
                >
                  {FILTER_LABELS[key]}: {value}
                  <X aria-hidden="true" className="size-3" />
                  <span className="sr-only">Remove filter</span>
                </button>
              ))}
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="text-caption font-medium text-muted-foreground underline-offset-2 hover:underline"
            >
              Clear all
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="p-4">
            <ErrorState error={error} onRetry={reload} />
          </div>
        ) : loading && rows.length === 0 ? (
          <TableSkeleton columns={5} />
        ) : rows.length === 0 ? (
          <div className="p-4">
            <EmptyState
              icon={Building2}
              title={
                search || activeFilterCount > 0 ? "No listings match" : "No live listings yet"
              }
              body={
                search
                  ? "Try a different phrase or widen the server-side filters."
                  : activeFilterCount > 0
                    ? "Try widening the county, rent or bedroom filters."
                    : "Listings appear here once an approved landlord publishes one."
              }
              action={
                activeFilterCount > 0 ? (
                  <Button variant="outline" onClick={() => setFilters(EMPTY_FILTERS)}>
                    <Filter />
                    Clear filters
                  </Button>
                ) : undefined
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
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">
                      <span className="inline-flex items-center gap-1.5">
                        Views
                        <DemoBadge feature="views" />
                      </span>
                    </TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <PropertyIdentity row={row} />
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {row.landlordName ?? <span className="italic">Not shared</span>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatLocation(row)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <PropertyStatusBadge status={row.status} />
                          {row.demo ? <DemoRowMark feature="propertyStatusFilter" /> : null}
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {formatCompact(row.views)}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDetail(row)}
                          aria-label={`View ${row.title}`}
                        >
                          <Eye />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <ul className="divide-y divide-border md:hidden">
              {rows.map((row) => (
                <li key={row.id} className="p-4">
                  <PropertyIdentity row={row} />

                  <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                    <PropertyStatusBadge status={row.status} />
                    {row.demo ? <DemoRowMark feature="propertyStatusFilter" /> : null}
                  </div>

                  <dl className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1 text-caption">
                    <div className="col-span-2 flex gap-1">
                      <dt className="text-muted-foreground">Landlord</dt>
                      <dd className="min-w-0 truncate text-foreground">
                        {row.landlordName ?? "Not shared"}
                      </dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Views</dt>
                      <dd className="text-foreground tabular-nums">{formatCompact(row.views)}</dd>
                    </div>
                    <div className="flex gap-1">
                      <dt className="text-muted-foreground">Listed</dt>
                      <dd className="text-foreground">{formatDate(row.createdAt)}</dd>
                    </div>
                  </dl>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDetail(row)}
                    className="mt-3"
                  >
                    <Eye />
                    Details
                  </Button>
                </li>
              ))}
            </ul>

            {wantsLive && pagination ? (
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

      <FiltersSheet
        open={filtersOpen}
        value={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
      />

      <PropertyDetailSheet row={detail} onClose={() => setDetail(null)} />

      <AddPropertyDialog open={addOpen} onClose={() => setAddOpen(false)} />
    </>
  );
}

function PropertyIdentity({ row }: { row: PropertyRow }) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="size-11 shrink-0 overflow-hidden rounded-lg bg-muted">
        {row.image ? (
          <img
            src={row.image}
            alt=""
            loading="lazy"
            className="size-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
        ) : (
          <span className="flex size-full items-center justify-center text-muted-foreground">
            <ImageOff aria-hidden="true" className="size-4" />
          </span>
        )}
      </div>
      <div className="min-w-0">
        <p className="truncate text-body-sm font-medium text-foreground">{row.title}</p>
        <p className="truncate text-caption text-muted-foreground">
          {row.rentFrom ? `From ${formatKes(row.rentFrom)}` : "No units priced yet"}
        </p>
      </div>
    </div>
  );
}

const FILTER_LABELS: Record<keyof ServerFilters, string> = {
  county: "County",
  town: "Town",
  estate: "Estate",
  minPrice: "Min rent",
  maxPrice: "Max rent",
  bedrooms: "Type",
};

/**
 * The design's "Filters" button.
 *
 * Every field here is a **real** query parameter on `GET /properties`, so this is
 * server-side filtering across the whole catalogue rather than the page. It is a
 * sheet rather than a popover because six fields at 360px need the full height, and
 * the same component then works on a desktop.
 *
 * It edits a local draft and applies on submit: each change is a network request,
 * and re-querying on every keystroke of a county name would be several wasted
 * round trips per word.
 */
function FiltersSheet({
  open,
  value,
  onClose,
  onApply,
}: {
  open: boolean;
  value: ServerFilters;
  onClose: () => void;
  onApply: (next: ServerFilters) => void;
}) {
  const [draft, setDraft] = useState(value);

  // Re-sync whenever it opens, so a cancelled edit is not remembered.
  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  function set(key: keyof ServerFilters, next: string) {
    setDraft((current) => ({ ...current, [key]: next }));
  }

  return (
    <Sheet open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Filter listings</SheetTitle>
        </SheetHeader>

        <form
          className="space-y-4 px-4"
          onSubmit={(event) => {
            event.preventDefault();
            onApply(draft);
          }}
        >
          <p className="text-caption text-muted-foreground">
            These run on the server across every live listing, not just this page.
          </p>

          <Field label="County" htmlFor="filter-county">
            <Select
              value={draft.county || "all"}
              onValueChange={(value) => set("county", value === "all" ? "" : value)}
            >
              <SelectTrigger id="filter-county" className="w-full">
                <SelectValue placeholder="All coastal counties" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All coastal counties</SelectItem>
                {COASTAL_COUNTIES.map((county) => (
                  <SelectItem key={county} value={county}>
                    {county}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Town" htmlFor="filter-town">
            <Input
              id="filter-town"
              value={draft.town}
              onChange={(event) => set("town", event.target.value)}
              placeholder="Westlands"
            />
          </Field>

          <Field label="Estate" htmlFor="filter-estate">
            <Input
              id="filter-estate"
              value={draft.estate}
              onChange={(event) => set("estate", event.target.value)}
              placeholder="Kilimani"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Min rent (KES)" htmlFor="filter-min">
              <Input
                id="filter-min"
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.minPrice}
                onChange={(event) => set("minPrice", event.target.value)}
                placeholder="10000"
              />
            </Field>
            <Field label="Max rent (KES)" htmlFor="filter-max">
              <Input
                id="filter-max"
                type="number"
                inputMode="numeric"
                min={0}
                value={draft.maxPrice}
                onChange={(event) => set("maxPrice", event.target.value)}
                placeholder="80000"
              />
            </Field>
          </div>

          <Field label="Unit type" htmlFor="filter-bedrooms">
            <Input
              id="filter-bedrooms"
              value={draft.bedrooms}
              onChange={(event) => set("bedrooms", event.target.value)}
              placeholder="2 Bedroom"
            />
            <p className="mt-1 text-caption text-muted-foreground">
              Matched inside the unit type, so "Bedroom" catches every bedroom size.
            </p>
          </Field>

          <SheetFooter className="px-0">
            <Button type="submit">Apply filters</Button>
            <Button type="button" variant="outline" onClick={() => setDraft(EMPTY_FILTERS)}>
              Reset
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-body-sm font-medium text-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

/**
 * Full listing detail.
 *
 * Only fetched for a real row — a sample row has no id the API knows, and asking
 * for one would 404. `GET /properties/:id` also answers `403 PROPERTY_HIDDEN` for
 * anything not ACTIVE, which is why the sheet handles an error by falling back to
 * the row it already has rather than showing a failure.
 */
function PropertyDetailSheet({ row, onClose }: { row: PropertyRow | null; onClose: () => void }) {
  const id = row && !row.demo ? row.id : null;

  const { data: detail, loading } = useAsync(
    async (signal) => (id ? getProperty(id, signal) : null),
    [id],
  );

  return (
    <Sheet open={Boolean(row)} onOpenChange={(open) => (open ? undefined : onClose())}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Listing details</SheetTitle>
        </SheetHeader>

        {row ? (
          <div className="space-y-5 px-4 pb-8">
            {detail?.images?.length ? (
              <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
                {detail.images.map((image) => (
                  <img
                    key={image}
                    src={image}
                    alt=""
                    loading="lazy"
                    className="h-32 w-44 shrink-0 rounded-lg object-cover"
                  />
                ))}
              </div>
            ) : null}

            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <PropertyStatusBadge status={row.status} />
                {row.demo ? <DemoRowMark feature="propertyStatusFilter" /> : null}
              </div>
              <h3 className="mt-2 text-h3 text-foreground">{row.title}</h3>
              <p className="mt-1 flex items-center gap-1.5 text-body-sm text-muted-foreground">
                <MapPin aria-hidden="true" className="size-3.5 shrink-0" />
                {formatLocation(row)}
              </p>
            </div>

            {detail?.description ? (
              <p className="text-body-sm whitespace-pre-line text-muted-foreground">
                {detail.description}
              </p>
            ) : null}

            <dl className="space-y-3 text-body-sm">
              <DetailRow label="Landlord" value={row.landlordName ?? "Not shared"} />
              {detail?.landlord ? (
                <>
                  <DetailRow
                    label="Landlord approved"
                    value={detail.landlord.verified ? "Yes" : "No"}
                  />
                  <DetailRow label="M-Pesa number" value={detail.landlord.mpesaNumber} />
                </>
              ) : null}
              <DetailRow
                label="Rent from"
                value={row.rentFrom ? formatKes(row.rentFrom) : "No units priced yet"}
              />
              <DetailRow label="Listed" value={formatDate(row.createdAt)} />
              <DetailRow
                label="Views"
                value={`${formatNumber(row.views)} (sample — nothing counts views yet)`}
              />
              {!row.demo ? <DetailRow label="Listing ID" value={row.id} /> : null}
            </dl>

            <div>
              <h4 className="text-body-sm font-semibold text-foreground">Units</h4>
              {loading && !detail ? (
                <p className="mt-2 flex items-center gap-2 text-body-sm text-muted-foreground">
                  <Spinner /> Loading units…
                </p>
              ) : detail?.units?.length ? (
                <ul className="mt-2 space-y-2">
                  {detail.units.map((unit) => (
                    <li
                      key={unit.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="text-body-sm font-medium text-foreground">{unit.unitType}</p>
                        <p className="text-caption text-muted-foreground">
                          {formatKes(unit.rent)} / month
                          {unit.deposit ? ` · ${formatKes(unit.deposit)} deposit` : ""}
                        </p>
                      </div>
                      <Pill tone={unit.vacancy ? "success" : "inactive"}>
                        {unit.availableUnits} of {unit.totalUnits} free
                      </Pill>
                    </li>
                  ))}
                </ul>
              ) : row.demo ? (
                <p className="mt-2 text-body-sm text-muted-foreground">
                  This is a sample row, so it has no units to show.
                </p>
              ) : (
                <p className="mt-2 text-body-sm text-muted-foreground">
                  No unit types have been added to this listing yet.
                </p>
              )}
            </div>
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}

function DetailRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-border pb-2.5 last:border-0">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium break-words text-foreground">{value || "—"}</dd>
    </div>
  );
}

/** The mockup's "+ Add Property". The endpoint refuses an admin outright. */
function AddPropertyDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add a property</DialogTitle>
          <DialogDescription>
            An admin can't create a listing. Publishing requires a verified landlord profile, and an
            admin account doesn't have one — the request is refused before it reaches the database.
          </DialogDescription>
        </DialogHeader>

        <p className="text-body-sm text-muted-foreground">
          To get a listing published: approve the landlord in the landlord queue, then have them add
          it from their own account. Posting on someone's behalf needs an endpoint that doesn't
          exist yet.
        </p>

        <DialogFooter>
          <Button onClick={onClose}>Got it</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** "ARCHIVED" -> "Archived". Local because it only ever sees a status enum. */
function titleCase(value: string): string {
  return value.charAt(0) + value.slice(1).toLowerCase();
}

/**
 * A price filter only reaches the server when it is a real number. Passing
 * `Number("12k")` through would send `NaN` and come back a validation error the
 * operator can do nothing useful with.
 */
function numberOrUndefined(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
}
