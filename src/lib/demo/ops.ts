/**
 * Sample data for the operational surfaces with no backend behind them:
 * verification documents, rejection history, reported listings, and the
 * non-live property rows an admin cannot fetch.
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
import { daysAgo, seededBetween, seededPick } from "@/lib/demo/seed";

// ------------------------------------------------------ verification documents

export type DocumentStatus = "RECEIVED" | "MISSING" | "UNREADABLE";

export type DemoDocument = { name: string; status: DocumentStatus };

export type DemoDocumentSet = {
  received: number;
  required: number;
  items: DemoDocument[];
};

const REQUIRED_DOCUMENTS = [
  "National ID (front)",
  "National ID (back)",
  "Business permit",
];

/**
 * A document set for one landlord, keyed off their id so the queue row and the
 * detail panel always agree. Most landlords are complete; roughly a third are
 * missing something, which is what gives the queue a reason to exist.
 */
export function demoDocuments(landlordId: string): DemoDocumentSet {
  const items = REQUIRED_DOCUMENTS.map((name, index) => {
    const roll = seededBetween(`doc:${landlordId}:${index}`, 0, 9);
    const status: DocumentStatus =
      roll >= 8 ? "MISSING" : roll === 7 ? "UNREADABLE" : "RECEIVED";
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
      location: "Kilifi Town, Kilifi",
      reason: "National ID photo unreadable — details could not be matched",
      submittedAt: daysAgo(14),
      rejectedAt: daysAgo(12),
      rejectedBy: "Admin User",
    },
    {
      id: "rej_02",
      name: "Sunrise Homes Ltd",
      location: "Nyali, Mombasa",
      reason: "Business permit expired in 2024",
      submittedAt: daysAgo(21),
      rejectedAt: daysAgo(19),
      rejectedBy: "Admin User",
    },
    {
      id: "rej_03",
      name: "Alice Muthoni",
      location: "Diani, Kwale",
      reason: "M-Pesa number registered to a different name",
      submittedAt: daysAgo(30),
      rejectedAt: daysAgo(27),
      rejectedBy: "Admin User",
    },
    {
      id: "rej_04",
      name: "Kanyi Rentals",
      location: "Voi, Taita-Taveta",
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
  "Mtwapa, Kilifi",
  "Nyali, Mombasa",
  "Diani, Kwale",
  "Shela, Lamu",
  "Hola, Tana River",
  "Voi, Taita-Taveta",
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
  const rows: {
    title: string;
    town: string;
    county: string;
    status: PropertyStatus;
  }[] = [
    {
      title: "4 Bedroom Beach Villa",
      town: "Watamu",
      county: "Kilifi",
      status: "DRAFT",
    },
    {
      title: "Bedsitter Block",
      town: "Mokowe",
      county: "Lamu",
      status: "DRAFT",
    },
    {
      title: "2 Bedroom Apartment",
      town: "Nyali",
      county: "Mombasa",
      status: "HIDDEN",
    },
    {
      title: "Studio Apartment",
      town: "Diani",
      county: "Kwale",
      status: "HIDDEN",
    },
    {
      title: "1 Bedroom Apartment",
      town: "Garsen",
      county: "Tana River",
      status: "ARCHIVED",
    },
    {
      title: "3 Bedroom Maisonette",
      town: "Voi",
      county: "Taita-Taveta",
      status: "ARCHIVED",
    },
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
