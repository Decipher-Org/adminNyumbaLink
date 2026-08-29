/**
 * Property reads for the admin console.
 *
 * There is no admin properties endpoint. `GET /properties` is the public catalogue
 * and it branches on role: a landlord sees their own rows at every status, and
 * **everyone else — admins included — gets `where.status = "ACTIVE"` hardcoded**.
 * So through the API as it stands an admin can see the live catalogue and nothing
 * else. Two consequences the Properties screen owns rather than hides:
 *
 *  1. DRAFT / HIDDEN / ARCHIVED listings are not fetchable. The screen says so in
 *     place of pretending the counts are complete.
 *  2. The list serialiser (`toListingCard`) has no landlord field, so a table
 *     column the mockup shows is missing from the only response that has the rows.
 *
 * `listPropertiesWithLandlord` fixes (2) by fetching the detail of each row on the
 * **visible page only** — `toPublicProperty` does include `landlord` and `units`.
 * That is an N+1, bounded by the page size (10 requests, not 4,852), which keeps
 * it well inside the 300-request/15-minute authenticated rate limit. It mirrors
 * the same trade-off the tenant client already documents for unit lookups.
 */

import { apiFetch, apiFetchPaged, type ApiPagination } from "./client";
import { runWithConcurrency } from "./concurrency";
import type { PropertyCard, PropertyDetail, PropertyLandlord } from "./types";

export type ListPropertiesParams = {
  page?: number;
  limit?: number;
  q?: string;
  county?: string;
  town?: string;
  estate?: string;
  minPrice?: number;
  maxPrice?: number;
  /** Matched as a substring of `unitType`, e.g. "2 Bedroom". */
  bedrooms?: string;
  availableOnly?: boolean;
  amenities?: string[];
  lat?: number;
  lng?: number;
  radiusKm?: number;
  sort?: "newest" | "price_asc" | "price_desc" | "distance";
  signal?: AbortSignal;
};

export async function listProperties({ signal, ...query }: ListPropertiesParams = {}): Promise<{
  items: PropertyCard[];
  pagination: ApiPagination;
}> {
  const { amenities, ...primitiveQuery } = query;
  const { data, pagination } = await apiFetchPaged<PropertyCard[]>("/properties", {
    query: {
      ...primitiveQuery,
      amenities: amenities?.length ? amenities.join(",") : undefined,
    },
    signal,
  });
  const items = Array.isArray(data) ? data : [];
  return {
    items,
    pagination: pagination ?? { page: 1, limit: items.length, total: items.length, totalPages: 1 },
  };
}

/**
 * Full detail including `landlord` and `units`.
 *
 * Answers `403 PROPERTY_HIDDEN` for anything not ACTIVE, even to an admin — the
 * ownership check short-circuits on `role !== LANDLORD`. Callers must expect that.
 */
export function getProperty(id: string, signal?: AbortSignal): Promise<PropertyDetail> {
  return apiFetch<PropertyDetail>(`/properties/${id}`, { signal });
}

export type AdminPropertyRow = PropertyCard & {
  landlord: PropertyLandlord | null;
  /** Summed across unit types: how many physical doors are advertised. */
  totalUnits: number | null;
  availableUnits: number | null;
};

/**
 * One page of live properties, each enriched with its landlord.
 *
 * This is N+1 requests by necessity — the list serialiser has no landlord field,
 * so the name in that column can only come from a per-row detail call. That makes
 * it the heaviest thing this console does, and the reason it goes through
 * `runWithConcurrency`: a full page of rows fetched all at once would put twice as
 * many queries on the backend's single database connection as it can drain before
 * the pool times out, and every row would 500 together.
 *
 * A detail request that fails is not fatal — the row still renders with a null
 * landlord, because losing one name is better than blanking the table. `null` is
 * therefore genuinely "unknown", not "no landlord".
 */
export async function listPropertiesWithLandlord(
  params: ListPropertiesParams = {},
): Promise<{ items: AdminPropertyRow[]; pagination: ApiPagination }> {
  const { items, pagination } = await listProperties(params);

  const enriched = await runWithConcurrency(
    items.map((card) => async (): Promise<AdminPropertyRow> => {
      try {
        const detail = await getProperty(card.id, params.signal);
        const units = detail.units ?? [];
        return {
          ...card,
          landlord: detail.landlord,
          totalUnits: units.length
            ? units.reduce((sum, unit) => sum + (unit.totalUnits ?? 0), 0)
            : null,
          availableUnits: units.length
            ? units.reduce((sum, unit) => sum + (unit.availableUnits ?? 0), 0)
            : null,
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        return { ...card, landlord: null, totalUnits: null, availableUnits: null };
      }
    }),
  );

  return { items: enriched, pagination };
}

/**
 * Search properties with filters, geolocation, sorting, pagination, and caching.
 * Uses the /search endpoint (Milestone 6) for full search capabilities.
 */
export async function searchProperties(
  params: Omit<ListPropertiesParams, "signal"> & { signal?: AbortSignal } = {},
): Promise<{ items: PropertyCard[]; pagination: ApiPagination }> {
  const { amenities, signal, ...query } = params;
  const { data, pagination } = await apiFetchPaged<PropertyCard[]>("/search", {
    query: {
      ...query,
      amenities: amenities?.length ? amenities.join(",") : undefined,
    },
    signal,
  });
  const items = Array.isArray(data) ? data : [];
  return {
    items,
    pagination: pagination ?? { page: 1, limit: items.length, total: items.length, totalPages: 1 },
  };
}

/**
 * Search properties with filters, geolocation, sorting, pagination, and caching,
 * and enrich each result with landlord and unit counts.
 * Uses the /search endpoint (Milestone 6) for the base search, then fetches
 * each property's detail to get landlord information.
 */
export async function searchPropertiesWithLandlord(
  params: Omit<ListPropertiesParams, "signal"> & { signal?: AbortSignal } = {},
): Promise<{ items: AdminPropertyRow[]; pagination: ApiPagination }> {
  const { items, pagination } = await searchProperties(params);

  const enriched = await runWithConcurrency(
    items.map((card) => async (): Promise<AdminPropertyRow> => {
      try {
        const detail = await getProperty(card.id, params.signal);
        const units = detail.units ?? [];
        return {
          ...card,
          landlord: detail.landlord,
          totalUnits: units.length
            ? units.reduce((sum, unit) => sum + (unit.totalUnits ?? 0), 0)
            : null,
          availableUnits: units.length
            ? units.reduce((sum, unit) => sum + (unit.availableUnits ?? 0), 0)
            : null,
        };
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") throw error;
        return { ...card, landlord: null, totalUnits: null, availableUnits: null };
      }
    }),
  );

  return { items: enriched, pagination };
}
