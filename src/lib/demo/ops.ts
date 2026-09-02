/**
 * Sample data for the operational surfaces with no backend behind them:
 * verification documents, rejection history, and the non-live property rows an
 * admin cannot fetch.
 *
 * Each of these is registered in `lib/demo/registry.ts` with the reason it is
 * fake. Two of them are fake for a stronger reason than "the endpoint isn't
 * written yet" — there is nowhere in the schema to put the data at all:
 *
 *  - **documents**: a landlord submits a `nationalId` string. No file is uploaded,
 *    so there is nothing to review or count.
 *  - **rejections**: approval is a single `verified` boolean. There is no rejected
 *    state and no column for a reason, so a rejection cannot be recorded.
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
