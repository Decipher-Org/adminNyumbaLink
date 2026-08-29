/**
 * `?next=` handling.
 *
 * A guard that redirects to login records where the operator was headed, and the
 * login screen sends them back there afterwards. The value is validated before
 * being used as a destination.
 */

/**
 * Only same-site absolute paths are honoured.
 *
 * A `next` that starts with `//` is protocol-relative — the browser reads
 * `//evil.example` as a different host, so a bare "starts with /" check would
 * turn this into an open redirect. `\` is rejected for the same reason: some
 * browsers normalise `/\evil.example` to `//evil.example`.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!value.startsWith("/")) return null;
  if (value.startsWith("//") || value.startsWith("/\\")) return null;
  return value;
}

export function loginPath(next?: string): string {
  const safe = safeNextPath(next);
  return safe && safe !== "/" ? `/login?next=${encodeURIComponent(safe)}` : "/login";
}

/**
 * Admin search criteria for the Properties page.
 */
export type AdminSearchCriteria = {
  /** Keyword search across title, description, estate, town, county */
  q?: string;
  /** County filter */
  county?: string;
  /** Town filter */
  town?: string;
  /** Estate/area filter */
  estate?: string;
  /** Minimum price */
  minPrice?: number;
  /** Maximum price */
  maxPrice?: number;
  /** Unit type (matched against unitType field) */
  bedrooms?: string;
  /** Only show available units */
  availableOnly?: boolean;
  /** Amenities filter (array of strings) */
  amenities?: string[];
  /** Latitude for geolocation search */
  lat?: number;
  /** Longitude for geolocation search */
  lng?: number;
  /** Radius in kilometers for geolocation search */
  radiusKm?: number;
  /** Sort order */
  sort?: "newest" | "price_asc" | "price_desc" | "distance";
};

/**
 * Turns admin search criteria into query string parameters for GET /properties.
 * All parameters are optional and only included if they have values.
 */
export function adminSearchParamsToQuery(criteria: AdminSearchCriteria = {}): string {
  const params = new URLSearchParams();

  if (criteria.q) {
    params.set("q", criteria.q);
  }

  if (criteria.county) {
    params.set("county", criteria.county);
  }

  if (criteria.town) {
    params.set("town", criteria.town);
  }

  if (criteria.estate) {
    params.set("estate", criteria.estate);
  }

  if (criteria.minPrice !== undefined) {
    params.set("minPrice", String(criteria.minPrice));
  }

  if (criteria.maxPrice !== undefined) {
    params.set("maxPrice", String(criteria.maxPrice));
  }

  if (criteria.bedrooms) {
    params.set("bedrooms", criteria.bedrooms);
  }

  if (criteria.availableOnly !== undefined) {
    params.set("availableOnly", String(criteria.availableOnly));
  }

  if (criteria.amenities && criteria.amenities.length > 0) {
    // Backend expects amenities as repeated parameters or array format
    // Using repeated parameters for compatibility
    criteria.amenities.forEach((amenity) => {
      params.append("amenities", amenity);
    });
  }

  if (criteria.lat !== undefined) {
    params.set("lat", String(criteria.lat));
  }

  if (criteria.lng !== undefined) {
    params.set("lng", String(criteria.lng));
  }

  if (criteria.radiusKm !== undefined) {
    params.set("radiusKm", String(criteria.radiusKm));
  }

  if (criteria.sort) {
    params.set("sort", criteria.sort);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

/**
 * Admin properties path with the visitor's criteria pre-applied.
 */
export function adminPropertiesPath(criteria: AdminSearchCriteria = {}): string {
  return `/properties${adminSearchParamsToQuery(criteria)}`;
}