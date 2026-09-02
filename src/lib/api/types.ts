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
 * column for — document counts, rejection reasons, view counts, growth deltas —
 * belong to `lib/demo/`, and every one of them is registered in
 * `lib/demo/registry.ts`.
 *
 * Payments, revenue and subscriptions used to be in that list. Milestones 4 and 5
 * built them, so their types are down at the bottom of this file, mirroring
 * `toPaymentDto` and the two admin list serialisers.
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

export const USER_STATUSES: UserStatus[] = [
  "ACTIVE",
  "SUSPENDED",
  "DEACTIVATED",
];

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
  /**
   * Milestone 5. Landlord subscriptions are **per property**, not per account, so
   * there is no single status to show. `properties` is *every* property this landlord
   * owns — `subscriptionSummaries` groups with no status and no subscription filter —
   * `active` is how many have a term with time left, and `lapsed` is the subtraction
   * of the two.
   *
   * So `lapsed` is wider than the word suggests: a property that never had a term at
   * all lands in it alongside one whose term ran out. "Not covered" is what it means,
   * which is why the UI words it that way rather than echoing the field name.
   *
   * Replaced a `subscriptionStatus: string` that was always the literal `"PENDING"`.
   */
  subscriptions: { properties: number; active: number; lapsed: number };
  /**
   * The same number as `subscriptions.properties` — all of this landlord's properties,
   * at any status. Not a live-listing count, despite how a bare "properties" column
   * reads next to the dashboard's `liveProperties`.
   */
  propertiesCount: number;
  createdAt: string;
  updatedAt: string;
};

// -------------------------------------------------------------- properties

export type PropertyStatus = "DRAFT" | "ACTIVE" | "HIDDEN" | "ARCHIVED";

export const PROPERTY_STATUSES: PropertyStatus[] = [
  "ACTIVE",
  "DRAFT",
  "HIDDEN",
  "ARCHIVED",
];

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

// ---------------------------------------------------------------- payments

/**
 * The five statuses in `PAYMENT_STATUSES` (`services/payments.js`), in the order a
 * payment moves through them.
 *
 * `PENDING` and `QUEUED` are the two non-terminal ones — a row in either can still
 * change, and `POST /payments/:id/reconcile` is how it gets asked to. The other three
 * are terminal and carry a `settledAt`, which is why revenue filters on `SUCCESS`
 * rather than on the timestamp being present.
 */
export type PaymentStatus =
  | "PENDING"
  | "QUEUED"
  | "SUCCESS"
  | "FAILED"
  | "CANCELLED";

export const PAYMENT_STATUSES: PaymentStatus[] = [
  "PENDING",
  "QUEUED",
  "SUCCESS",
  "FAILED",
  "CANCELLED",
];

/** `PAYMENT_PURPOSES` — what the money bought. */
export type PaymentPurpose =
  | "LANDLORD_SUBSCRIPTION"
  | "LANDLORD_UNIT_TOPUP"
  | "TENANT_DAILY_ACCESS"
  | "BOOST_LISTING"
  | "FEATURED_PROPERTY";

export const PAYMENT_PURPOSES: PaymentPurpose[] = [
  "LANDLORD_SUBSCRIPTION",
  "LANDLORD_UNIT_TOPUP",
  "TENANT_DAILY_ACCESS",
  "BOOST_LISTING",
  "FEATURED_PROPERTY",
];

/**
 * Shorter than the enum and in the words the team uses. `formatEnum` would give
 * "Landlord subscription" and "Tenant daily access", which are the database's names
 * for these, not a person's.
 *
 * `BOOST_LISTING` and `FEATURED_PROPERTY` are priced on the backend but nothing sells
 * them yet, so they are labelled here for the filter and will never appear on a row
 * until they do.
 */
export const PURPOSE_LABELS: Record<PaymentPurpose, string> = {
  LANDLORD_SUBSCRIPTION: "Listing term",
  LANDLORD_UNIT_TOPUP: "Extra units",
  TENANT_DAILY_ACCESS: "Browsing pass",
  BOOST_LISTING: "Boost",
  FEATURED_PROPERTY: "Featured",
};

/** One rail. Typed as a union anyway so adding one is a compile error, not a silent gap. */
export type PaymentProvider = "MPESA";

/**
 * A payment as `toPaymentDto` serialises it — the shape every payment route returns.
 *
 * Split out from `AdminPayment` because `/payments/:id` and `/payments/:id/reconcile`
 * return exactly this and nothing more. Typing those responses as the wider row would
 * claim three fields that are genuinely absent, and the reconcile handler's job is to
 * merge rather than replace because of it.
 */
export type PaymentDto = {
  id: string;
  userId: string;
  /** Whole KES. Priced server-side from `purpose`; a client never names an amount. */
  amount: number;
  currency: string;
  provider: PaymentProvider;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  /** E.164 — the number the STK prompt went to, not necessarily the account's. */
  phoneNumber: string | null;
  /** Null for the flat purposes (`TENANT_DAILY_ACCESS`). */
  propertyId: string | null;
  unitCount: number | null;
  /** The M-Pesa receipt once settled, our own reference before then. Always present. */
  transactionReference: string;
  /** Null until `SUCCESS`. Unique across all payments. */
  mpesaReceipt: string | null;
  /** Daraja's code via PayHero: `0` success, `1032` cancelled, `1` insufficient funds. */
  resultCode: number | null;
  resultDesc: string | null;
  /** Our own summary when a payment failed short of the handset. */
  failureReason: string | null;
  /** Set when a terminal status was written — on failure and cancellation too. */
  settledAt: string | null;
  createdAt: string;
  updatedAt: string;
};

/**
 * `GET /admin/payments`, from `toPaymentDto` plus the three admin-only additions.
 *
 * `gatewayReference` and `checkoutRequestId` appear on this route and nowhere else —
 * they are PayHero's and Daraja's own identifiers, what support quotes upstream when
 * chasing a transaction. The embedded `user` saves a second lookup for the question
 * this screen is usually open to answer.
 */
export type AdminPayment = PaymentDto & {
  gatewayReference: string | null;
  checkoutRequestId: string | null;
  user: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string | null;
  } | null;
};

/**
 * `POST /payments/:id/reconcile`.
 *
 * `applied: false` is **not** a failure. It means the gateway had nothing new to tell
 * us — already settled, never reached PayHero, or not recognised yet — and the
 * backend's `message` says which. Render that message; do not translate a false into
 * an error.
 *
 * `payment` is the narrow DTO, so a screen holding an `AdminPayment` must spread this
 * over the row it already has rather than swapping it in — otherwise a reconcile would
 * blank the payer's name.
 */
export type ReconcileResult = { payment: PaymentDto; applied: boolean };

/** `GET /admin/payments/revenue` — one day's takings. `amount` is 0 on a day nobody paid. */
export type RevenuePoint = { date: string; amount: number; count: number };

/**
 * The whole series. `total` always equals the sum of `points[].amount`, and `points`
 * is zero-filled, oldest first, and exactly `days` long — so a chart and a stat card
 * drawn from the same payload cannot disagree.
 */
export type RevenueSeries = {
  days: number;
  from: string;
  to: string;
  total: number;
  currency: string;
  points: RevenuePoint[];
};

// ----------------------------------------------------------- subscriptions

/**
 * One entry in a subscription's ledger (`SubscriptionGrant`), newest first, last 5.
 *
 * `PURCHASE` is the first term on a property, `RENEWAL` a fresh term on an existing
 * one, and `TOPUP` capacity added mid-term without moving the expiry. `units` is the
 * whole count for the first two and only the increment for a top-up.
 */
export type SubscriptionGrant = {
  kind: "PURCHASE" | "RENEWAL" | "TOPUP";
  units: number;
  /** Whole KES actually charged, so the ledger reconciles without joining Payment. */
  amount: number;
  paymentId: string;
  createdAt: string;
};

/**
 * `GET /admin/subscriptions` — a 30-day term on one property, priced per rentable unit.
 *
 * Nothing here recurs. There is no plan, no tier, and no cancellation: a term either
 * has time left (`active`) or it doesn't.
 */
export type AdminSubscription = {
  id: string;
  propertyId: string;
  propertyTitle: string;
  propertyStatus: PropertyStatus;
  landlord: {
    id: string;
    businessName: string | null;
    mpesaNumber: string | null;
  } | null;
  /** `expiresAt > now`, computed server-side against one clock. */
  active: boolean;
  /** Units the term was bought for. Set on purchase/renewal, incremented by top-ups. */
  paidUnits: number;
  /** `sum(units.totalUnits)` today — what the property actually offers. */
  currentUnits: number;
  /**
   * `max(0, currentUnits - paidUnits)`, and **should always be 0**: the write-side
   * guards in `services/subscriptions.js` refuse the change that would create one. A
   * non-zero value is a report that a guard was bypassed, not a number to bill for.
   */
  unpaidUnits: number;
  /** The price this term was **bought** at, not today's price. Never relabel it "current". */
  unitPrice: number;
  startedAt: string;
  expiresAt: string;
  grants: SubscriptionGrant[];
};

// ---------------------------------------------------------------- notifications

/**
 * `NOTIFICATION_TYPES` in `src/services/notifications.js`.
 *
 * The `ADMIN_*` types are the ones this console actually receives day to day; the rest
 * are landlord- and tenant-facing and appear here only because an admin account can hold
 * any notification the backend writes (a payment an admin made, say). `KIND_META` in
 * `pages/Notifications.tsx` must cover every member.
 */
export type NotificationType =
  | "ADMIN_LANDLORD_PENDING"
  | "ADMIN_PAYMENT_RECEIVED"
  | "ADMIN_PAYMENT_FAILED"
  | "ADMIN_DUPLICATE_RECEIPT"
  | "ADMIN_PROPERTY_PUBLISHED"
  | "SUBSCRIPTION_EXPIRING"
  | "PAYMENT_SUCCESS"
  | "PROPERTY_HIDDEN"
  | "PROPERTY_VIEWED"
  | "PROPERTY_REVIEWED"
  | "NEW_MATCHING_PROPERTY"
  | "SYSTEM_ALERT";

/**
 * `toNotificationDto` in `src/services/notifications.js`. The `data` bag is
 * opaque JSON the backend stores for deep-link context (e.g. `propertyId`);
 * screens that need a specific key narrow it themselves.
 */
export type Notification = {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
};

// ------------------------------------------------------------------- reports

export type ReportStatus = "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";

export const REPORT_STATUSES: ReportStatus[] = [
  "OPEN",
  "REVIEWING",
  "RESOLVED",
  "DISMISSED",
];

export type ReportReason =
  | "MISLEADING_PHOTOS"
  | "WRONG_PRICE"
  | "ALREADY_TAKEN"
  | "SUSPECTED_SCAM"
  | "DUPLICATE"
  | "OTHER";

export const REPORT_REASONS: ReportReason[] = [
  "MISLEADING_PHOTOS",
  "WRONG_PRICE",
  "ALREADY_TAKEN",
  "SUSPECTED_SCAM",
  "DUPLICATE",
  "OTHER",
];

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  MISLEADING_PHOTOS: "Misleading photos",
  WRONG_PRICE: "Wrong price",
  ALREADY_TAKEN: "Already taken",
  SUSPECTED_SCAM: "Suspected scam",
  DUPLICATE: "Duplicate listing",
  OTHER: "Other reason",
};

export type ReportAction =
  | "PROPERTY_HIDDEN"
  | "DISMISSED"
  | "RESOLVED"
  | "REVIEWING";

export type AdminReport = {
  id: string;
  propertyId: string;
  reason: ReportReason;
  description: string | null;
  status: ReportStatus;
  action: ReportAction | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string | null;
  resolvedBy: { id: string; name: string; email: string } | null;
  reporter: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    role: Role;
    status: UserStatus;
  };
  property: {
    id: string;
    title: string;
    status: PropertyStatus;
    county: string;
    town: string;
    estate: string | null;
    images: string[];
    landlord: {
      id: string;
      userId: string;
      businessName: string | null;
      nationalId: string;
      mpesaNumber: string | null;
      verified: boolean;
      name: string | null;
      email: string | null;
      phone: string | null;
      accountStatus: UserStatus;
    } | null;
  };
};

// ---------------------------------------------------------------- audit logs

export type AdminAuditLog = {
  id: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  admin: {
    id: string;
    name: string;
    email: string;
  };
};
