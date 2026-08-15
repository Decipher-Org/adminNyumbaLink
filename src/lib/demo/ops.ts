/**
 * Sample data for the operational surfaces with no backend behind them:
 * verification documents, rejection history, reported listings, notifications,
 * and the non-live property rows an admin cannot fetch.
 *
 * Each of these is registered in `lib/demo/registry.ts` with the reason it is
 * fake. Three of them are fake for a stronger reason than "the endpoint isn't
 * written yet" — there is nowhere in the schema to put the data at all:
 *
 *  - **documents**: a landlord submits a `nationalId` string. No file is uploaded,
 *    so there is nothing to review or count.
 *  - **rejections**: approval is a single `verified` boolean. There is no rejected
 *    state and no column for a reason, so a rejection cannot be recorded.
 *  - **reports**: tenants have no way to report a listing and no table stores one.
 *
 * That distinction is in the tooltips, because "coming in Milestone 10" and
 * "needs a schema change" are different promises.
 */

import type { PropertyStatus } from "@/lib/api/types";
import { daysAgo, minutesAgo, seededBetween, seededPick } from "@/lib/demo/seed";

// ------------------------------------------------------ verification documents

export type DocumentStatus = "RECEIVED" | "MISSING" | "UNREADABLE";

export type DemoDocument = { name: string; status: DocumentStatus };

export type DemoDocumentSet = {
  received: number;
  required: number;
  items: DemoDocument[];
};

const REQUIRED_DOCUMENTS = ["National ID (front)", "National ID (back)", "Business permit"];

/**
 * A document set for one landlord, keyed off their id so the queue row and the
 * detail panel always agree. Most landlords are complete; roughly a third are
 * missing something, which is what gives the queue a reason to exist.
 */
export function demoDocuments(landlordId: string): DemoDocumentSet {
  const items = REQUIRED_DOCUMENTS.map((name, index) => {
    const roll = seededBetween(`doc:${landlordId}:${index}`, 0, 9);
    const status: DocumentStatus = roll >= 8 ? "MISSING" : roll === 7 ? "UNREADABLE" : "RECEIVED";
    return { name, status };
  });

  return {
    received: items.filter((item) => item.status === "RECEIVED").length,
    required: items.length,
    items,
  };
}

// -------------------------------------------------------- rejection history

export type DemoRejection = {
  id: string;
  name: string;
  location: string;
  reason: string;
  submittedAt: string;
  rejectedAt: string;
  rejectedBy: string;
};

export function demoRejections(): DemoRejection[] {
  return [
    {
      id: "rej_01",
      name: "Kevin Odhiambo",
      location: "Kisumu, Kisumu",
      reason: "National ID photo unreadable — details could not be matched",
      submittedAt: daysAgo(14),
      rejectedAt: daysAgo(12),
      rejectedBy: "Admin User",
    },
    {
      id: "rej_02",
      name: "Sunrise Homes Ltd",
      location: "Mombasa, Mombasa",
      reason: "Business permit expired in 2024",
      submittedAt: daysAgo(21),
      rejectedAt: daysAgo(19),
      rejectedBy: "Admin User",
    },
    {
      id: "rej_03",
      name: "Alice Muthoni",
      location: "Nakuru, Nakuru",
      reason: "M-Pesa number registered to a different name",
      submittedAt: daysAgo(30),
      rejectedAt: daysAgo(27),
      rejectedBy: "Admin User",
    },
    {
      id: "rej_04",
      name: "Kanyi Rentals",
      location: "Thika, Kiambu",
      reason: "Duplicate application — already approved under another account",
      submittedAt: daysAgo(38),
      rejectedAt: daysAgo(36),
      rejectedBy: "Admin User",
    },
  ];
}

// -------------------------------------------------------- reported listings

export type ReportReason =
  | "MISLEADING_PHOTOS"
  | "WRONG_PRICE"
  | "ALREADY_TAKEN"
  | "SUSPECTED_SCAM"
  | "DUPLICATE";

export type ReportStatus = "OPEN" | "REVIEWING" | "RESOLVED" | "DISMISSED";

export type DemoReport = {
  id: string;
  propertyTitle: string;
  location: string;
  landlord: string;
  reason: ReportReason;
  status: ReportStatus;
  reporter: string;
  note: string;
  createdAt: string;
};

export const REPORT_REASON_LABELS: Record<ReportReason, string> = {
  MISLEADING_PHOTOS: "Misleading photos",
  WRONG_PRICE: "Wrong price",
  ALREADY_TAKEN: "Already taken",
  SUSPECTED_SCAM: "Suspected scam",
  DUPLICATE: "Duplicate listing",
};

const REPORT_NOTES: Record<ReportReason, string> = {
  MISLEADING_PHOTOS: "Photos show a different unit to the one viewed.",
  WRONG_PRICE: "Rent quoted on the phone is higher than the listing.",
  ALREADY_TAKEN: "Unit was occupied when the tenant arrived.",
  SUSPECTED_SCAM: "Deposit requested before any viewing.",
  DUPLICATE: "Same unit posted twice under different landlords.",
};

const REPORT_TITLES = [
  "2 Bedroom Apartment",
  "Modern Studio",
  "Spacious Bedsitter",
  "3 Bedroom Maisonette",
  "1 Bedroom Apartment",
  "Furnished Studio",
] as const;

const REPORT_AREAS = [
  "Kilimani, Nairobi",
  "Ruaka, Kiambu",
  "Nyali, Mombasa",
  "Westlands, Nairobi",
  "Milimani, Kisumu",
  "Kikuyu, Kiambu",
] as const;

let cachedReports: DemoReport[] | null = null;

export function demoReports(): DemoReport[] {
  if (cachedReports) return cachedReports;

  cachedReports = Array.from({ length: 14 }, (_, index) => {
    const key = `rep:${index}`;
    const reason = seededPick<ReportReason>(`${key}:reason`, [
      "MISLEADING_PHOTOS",
      "WRONG_PRICE",
      "ALREADY_TAKEN",
      "SUSPECTED_SCAM",
      "DUPLICATE",
    ]);
    return {
      id: `rpt_${String(index + 1).padStart(3, "0")}`,
      propertyTitle: seededPick(`${key}:title`, REPORT_TITLES),
      location: seededPick(`${key}:area`, REPORT_AREAS),
      landlord: seededPick(`${key}:landlord`, [
        "Grace Wanjiku",
        "Otieno Properties",
        "Amina Hassan",
        "Peter Mwangi",
      ]),
      reason,
      status: seededPick<ReportStatus>(`${key}:status`, [
        "OPEN",
        "OPEN",
        "REVIEWING",
        "RESOLVED",
        "DISMISSED",
      ]),
      reporter: seededPick(`${key}:reporter`, [
        "tenant****@gmail.com",
        "j****@yahoo.com",
        "m****@outlook.com",
      ]),
      note: REPORT_NOTES[reason],
      createdAt: daysAgo(seededBetween(`${key}:age`, 0, 25)),
    };
  });

  return cachedReports;
}

// ------------------------------------------------------------ notifications

export type NotificationKind = "approval" | "report" | "payment" | "system" | "user";

export type DemoNotification = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  at: string;
  read: boolean;
};

/**
 * Eight unread, which is the count the sidebar badge shows. The badge reads its
 * number from this list rather than hardcoding one, so the two can never disagree.
 */
export function demoNotifications(): DemoNotification[] {
  return [
    {
      id: "n1",
      kind: "approval",
      title: "3 landlords awaiting approval",
      body: "Grace Wanjiku, Ibrahim Abdi and Ruth Moraa submitted details today.",
      at: minutesAgo(6),
      read: false,
    },
    {
      id: "n2",
      kind: "report",
      title: "New listing report",
      body: "Studio in Ruaka flagged as misleading photos.",
      at: minutesAgo(41),
      read: false,
    },
    {
      id: "n3",
      kind: "payment",
      title: "Payment failed",
      body: "Otieno Properties · KSh 4,500 · M-Pesa timeout.",
      at: minutesAgo(96),
      read: false,
    },
    {
      id: "n4",
      kind: "user",
      title: "Suspension appeal",
      body: "brian.k@example.com replied to their suspension notice.",
      at: minutesAgo(150),
      read: false,
    },
    {
      id: "n5",
      kind: "system",
      title: "Storage at 72%",
      body: "Property image uploads are using 72% of the configured volume.",
      at: minutesAgo(320),
      read: false,
    },
    {
      id: "n6",
      kind: "approval",
      title: "Documents re-submitted",
      body: "Sunrise Homes Ltd uploaded a new business permit.",
      at: minutesAgo(500),
      read: false,
    },
    {
      id: "n7",
      kind: "payment",
      title: "12 subscriptions expire this week",
      body: "Renewal reminders are queued for Thursday.",
      at: minutesAgo(720),
      read: false,
    },
    {
      id: "n8",
      kind: "report",
      title: "Report escalated",
      body: "Suspected scam listing in Nyali needs a second reviewer.",
      at: minutesAgo(900),
      read: false,
    },
    {
      id: "n9",
      kind: "system",
      title: "Nightly backup completed",
      body: "Database snapshot finished in 4m 12s.",
      at: minutesAgo(1_380),
      read: true,
    },
    {
      id: "n10",
      kind: "user",
      title: "Role changed",
      body: "faith.n@example.com was promoted to landlord.",
      at: minutesAgo(2_100),
      read: true,
    },
  ];
}

// ------------------------------------------------------- non-live properties

export type DemoPropertyRow = {
  id: string;
  title: string;
  county: string;
  town: string;
  estate: string | null;
  status: PropertyStatus;
  landlordName: string;
  unitsFrom: number | null;
  views: number;
  createdAt: string;
};

/**
 * Draft, hidden and archived listings.
 *
 * `GET /properties` hardcodes `status: "ACTIVE"` for any caller who is not the
 * owning landlord, so these rows genuinely cannot be fetched by an admin — not
 * with a filter, not with a flag. Every one is badged in the table so it can never
 * be mistaken for a real listing.
 */
export function demoNonLiveProperties(): DemoPropertyRow[] {
  const rows: { title: string; town: string; county: string; status: PropertyStatus }[] = [
    { title: "4 Bedroom Villa", town: "Karen", county: "Nairobi", status: "DRAFT" },
    { title: "Bedsitter Block", town: "Kahawa", county: "Nairobi", status: "DRAFT" },
    { title: "2 Bedroom Apartment", town: "Nyali", county: "Mombasa", status: "HIDDEN" },
    { title: "Studio Apartment", town: "Milimani", county: "Kisumu", status: "HIDDEN" },
    { title: "1 Bedroom Apartment", town: "Ruaka", county: "Kiambu", status: "ARCHIVED" },
    { title: "3 Bedroom Maisonette", town: "Syokimau", county: "Machakos", status: "ARCHIVED" },
  ];

  return rows.map((row, index) => ({
    id: `demo_prop_${index + 1}`,
    title: row.title,
    county: row.county,
    town: row.town,
    estate: null,
    status: row.status,
    landlordName: seededPick(`demoprop:${index}`, [
      "Grace Wanjiku",
      "Otieno Properties",
      "Amina Hassan",
      "Peter Mwangi",
    ]),
    unitsFrom: seededBetween(`demoprop:${index}:rent`, 12, 85) * 1_000,
    views: seededBetween(`demoprop:${index}:views`, 40, 900),
    createdAt: daysAgo(seededBetween(`demoprop:${index}:age`, 5, 120)),
  }));
}

/** A stable view count for a **real** property. Nothing counts views yet. */
export function demoPropertyViews(propertyId: string): number {
  return seededBetween(`propviews:${propertyId}`, 46, 2_480);
}
