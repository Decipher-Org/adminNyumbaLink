/**
 * Wire types for `propertyHubBackend`, as the **admin** endpoints serialise them.
 *
 * These mirror `src/routes/admin.js` exactly — `toAdminUser` and
 * `toAdminLandlord`, not the Prisma models. The admin shapes differ from the
 * self-service ones in both directions, so they are typed separately rather than
 * shared with the tenant client's `types.ts`:
 *
 *  - the admin user adds `suspendedAt` / `suspendedReason`, which no other view
 *    is allowed to see;
 *  - the admin landlord adds the identity being vouched for (`name`, `email`,
 *    `nationalId`) plus `accountStatus`, which the public view hides.
 *
 * Nothing invented lives here. Fields the mockup shows but the backend has no
 * column for — document counts, rejection reasons, view counts, revenue — belong
 * to `lib/demo/`, and every one of them is registered in `lib/demo/registry.ts`.
 */

export type Role = "TENANT" | "LANDLORD" | "ADMIN";

export const ROLES: Role[] = ["ADMIN", "LANDLORD", "TENANT"];

/**
 * `SUSPENDED` is admin-initiated and reversible by an admin;
 * `DEACTIVATED` is user-initiated (`DELETE /users/me`) and an admin **cannot**
 * reverse it — `PATCH /reinstate` answers `400 USER_NOT_SUSPENDED`. The UI must
 * not offer reinstatement on a deactivated account.
 */
export type UserStatus = "ACTIVE" | "SUSPENDED" | "DEACTIVATED";

export const USER_STATUSES: UserStatus[] = ["ACTIVE", "SUSPENDED", "DEACTIVATED"];

/** The account shape Better Auth returns from sign-in and `get-session`. */
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  role: Role;
  status: UserStatus;
  phoneNumber?: string | null;
  phoneNumberVerified?: boolean | null;
  createdAt?: string;
  updatedAt?: string;
};

/** `POST /api/auth/sign-in/email`. Sign-up returns `token: null`; admins are not created here. */
export type AuthResponse = {
  token: string | null;
  user: AuthUser;
  redirect?: boolean;
};

/** `GET /api/auth/get-session` — both fields are null when unauthenticated. */
export type SessionResponse = {
  session: { id: string; expiresAt: string } | null;
  user: AuthUser | null;
} | null;

// ------------------------------------------------------------------- users

/** `GET /admin/users` and `/admin/users/:id`, from `toAdminUser`. */
export type AdminUser = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  /** Email verification. Named `isVerified` by the serialiser, not `emailVerified`. */
  isVerified: boolean;
  phoneVerified: boolean;
  status: UserStatus;
  /** Set only while `status === "SUSPENDED"`; cleared on reinstate. */
  suspendedAt: string | null;
  suspendedReason: string | null;
  createdAt: string;
  updatedAt: string;
};

// --------------------------------------------------------------- landlords

/**
 * `GET /admin/landlords`, from `toAdminLandlord`.
 *
 * `id` is the **landlord profile id** and `userId` the account id. They are not
 * interchangeable: `/admin/landlords/:id/approve` wants the profile id, while
 * `/admin/users/:id/suspend` wants the user id. Sending the wrong one is a 404.
 */
export type AdminLandlord = {
  id: string;
  userId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** The *account* status. Distinct from `verified`, which is approval. */
  accountStatus: UserStatus;
  nationalId: string;
  businessName: string | null;
  mpesaNumber: string | null;
  profilePhoto: string | null;
  /** Admin-controlled approval. Property writes are `403 LANDLORD_NOT_VERIFIED` until true. */
  verified: boolean;
  /** Placeholder until Milestone 5 — the backend returns a constant "PENDING". */
  subscriptionStatus: string;
  /** Real since Milestone 3: a live `property.count` for this landlord. */
  propertiesCount: number;
  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------- properties

export type PropertyStatus = "DRAFT" | "ACTIVE" | "HIDDEN" | "ARCHIVED";

export const PROPERTY_STATUSES: PropertyStatus[] = ["ACTIVE", "DRAFT", "HIDDEN", "ARCHIVED"];

/**
 * `GET /properties` — deliberately thin, and **role-sensitive on the server**.
 *
 * For an admin the route falls into its `else` branch and hardcodes
 * `where.status = "ACTIVE"`. There is no `status` or `landlordId` query param, so
 * an admin genuinely cannot list DRAFT/HIDDEN/ARCHIVED listings through the API
 * as it stands. `lib/api/properties.ts` documents what the screen does about it.
 */
export type PropertyCard = {
  id: string;
  title: string;
  county: string;
  town: string;
  estate: string | null;
  /** At most one image; the serialiser slices the set. */
  images: string[];
  status: PropertyStatus;
  /** Cheapest unit rent in KES, or null when no units exist yet. */
  unitsFrom: number | null;
  createdAt: string;
};

/** The public landlord block embedded in a property detail. Never `nationalId`. */
export type PropertyLandlord = {
  id: string;
  businessName: string | null;
  mpesaNumber: string | null;
  profilePhoto: string | null;
  verified: boolean;
};

/**
 * A unit is a **type** of dwelling ("Bedsitter", "1 Bedroom"), not one physical
 * door. `vacancy` is derived server-side as `availableUnits > 0` and never stored.
 */
export type Unit = {
  id: string;
  propertyId?: string;
  unitType: string;
  rent: number;
  deposit?: number | null;
  totalUnits: number;
  availableUnits: number;
  vacancy: boolean;
  amenities?: string[];
  updatedAt?: string;
};

export type PropertyDetail = {
  id: string;
  title: string;
  description: string | null;
  county: string;
  town: string;
  estate: string | null;
  latitude: number | null;
  longitude: number | null;
  images: string[];
  status: PropertyStatus;
  landlord: PropertyLandlord | null;
  units: Unit[];
  createdAt?: string;
  updatedAt?: string;
};
