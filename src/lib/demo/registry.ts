/**
 * The registry of everything in this console that is **not** backed by a real
 * endpoint.
 *
 * The backend is complete through Milestone 3 — auth, profiles, properties,
 * units, and the admin users/landlords routes that came with Milestones 1 and 2.
 * The design covers a great deal more, so those surfaces are built and fed from
 * `lib/demo/` instead. This file is the index: one entry per fake feature, naming
 * the milestone that replaces it.
 *
 * The rule this enforces: **nothing fake is unlabelled.** A screen that reads
 * from `lib/demo/` must render `<DemoBadge>` or `<DemoNotice>`, and a value that
 * isn't in `lib/demo/` must have come from the API. That makes replacing a mock a
 * one-file change, and makes an audit a `grep` rather than a reading exercise.
 *
 * It matters more here than in the tenant app. An operator acts on what this
 * screen tells them — suspending an account or approving a landlord on the
 * strength of a number. A fake number that looks real is not a cosmetic problem.
 */

export type DemoFeatureId =
  | "growthDeltas"
  | "registrationsTrend"
  | "revenue"
  | "payments"
  | "subscriptions"
  | "activityFeed"
  | "views"
  | "analytics"
  | "reports"
  | "notifications"
  | "landlordDocuments"
  | "rejections"
  | "bulkActions"
  | "export"
  | "propertyStatusFilter"
  | "createUser"
  | "createProperty"
  | "fullTextSearch"
  | "platformSettings";

export type DemoFeature = {
  label: string;
  /** Which backend milestone makes this real. */
  milestone: string;
  /** Shown in tooltips and banners; plain language, no jargon. */
  note: string;
};

export const DEMO_FEATURES: Record<DemoFeatureId, DemoFeature> = {
  growthDeltas: {
    label: "Growth percentages",
    milestone: "Milestone 10",
    note: "The counts themselves are live. The percentage beside each one is a sample — no endpoint reports a previous period to compare against yet.",
  },
  registrationsTrend: {
    label: "Registrations over time",
    milestone: "Milestone 10",
    note: "Sample curve. Users can only be counted in total right now, not grouped by the day they signed up.",
  },
  revenue: {
    label: "Revenue",
    milestone: "Milestone 4",
    note: "Sample figures. No payment has ever been recorded — M-Pesa and card collection are not connected.",
  },
  payments: {
    label: "Payments",
    milestone: "Milestone 4",
    note: "Sample transactions. There is no payments table and no M-Pesa integration yet.",
  },
  subscriptions: {
    label: "Subscriptions",
    milestone: "Milestone 5",
    note: "Sample plans and expiry dates. The backend returns a fixed placeholder status for every landlord and nothing is gated by a plan.",
  },
  activityFeed: {
    label: "Recent activity",
    milestone: "Milestone 10",
    note: "Sample events. The platform keeps no audit log, so admin and user actions are not recorded anywhere.",
  },
  views: {
    label: "Listing views",
    milestone: "Milestone 10",
    note: "Sample counts. Nothing increments a view counter on a property yet.",
  },
  analytics: {
    label: "Analytics",
    milestone: "Milestone 10",
    note: "Sample traffic, device and engagement figures. No analytics are collected.",
  },
  reports: {
    label: "Reported listings",
    milestone: "Milestone 10",
    note: "Sample reports. Tenants have no way to report a listing yet and there is nowhere to store one.",
  },
  notifications: {
    label: "Notifications",
    milestone: "Milestone 7",
    note: "Sample alerts. No notification is generated, stored or delivered.",
  },
  landlordDocuments: {
    label: "Verification documents",
    milestone: "needs a schema change",
    note: "Sample documents. A landlord submits a national ID number, but the platform stores no uploaded files to review — approval is currently a judgement on the details shown.",
  },
  rejections: {
    label: "Rejection history",
    milestone: "needs a schema change",
    note: "Sample rejections. Approval is a single boolean with no rejection state and nowhere to record a reason, so a rejection cannot be saved.",
  },
  bulkActions: {
    label: "Bulk actions",
    milestone: "Milestone 10",
    note: "Selecting rows works, but each approval is still one request — there is no bulk endpoint, so a large selection would be a burst of individual calls.",
  },
  export: {
    label: "Export",
    milestone: "Milestone 10",
    note: "Exports the rows currently loaded on screen as CSV. There is no server-side export, so it cannot cover every page.",
  },
  propertyStatusFilter: {
    label: "Draft, hidden and archived listings",
    milestone: "Milestone 10",
    note: "The properties endpoint returns only live listings to an admin — there is no way to ask it for drafts, hidden or archived ones, so those rows are samples and the totals cover live listings only.",
  },
  createUser: {
    label: "Add user",
    milestone: "Milestone 10",
    note: "There is no admin endpoint that creates an account. People sign up themselves; an admin can then change their role.",
  },
  createProperty: {
    label: "Add property",
    milestone: "Milestone 10",
    note: "Only a verified landlord can create a listing — the endpoint refuses an admin. Adding on someone's behalf is not possible yet.",
  },
  fullTextSearch: {
    label: "Property search",
    milestone: "Milestone 6",
    note: "Filters the listings already loaded on this page. Searching a title across the whole catalogue is not supported yet — county and town filters are, and those run on the server.",
  },
  platformSettings: {
    label: "Platform settings",
    milestone: "not yet scheduled",
    note: "Nothing on this screen is saved. There is no settings store — these values live in the backend's environment configuration.",
  },
};
