/**
 * Sample payments and subscriptions.
 *
 * Milestone 4 (payments) and Milestone 5 (subscriptions) are not built. There is
 * no payments table, no M-Pesa integration, and `toAdminLandlord` returns the
 * literal string "PENDING" as every landlord's `subscriptionStatus`. So both
 * screens are complete UI over invented rows, behind a `<DemoNotice>`.
 *
 * Generated from a seed rather than hand-written, so there are enough rows to
 * exercise pagination, filtering and the mobile card layout — and so the same row
 * keeps the same reference between renders.
 */

import { daysAgo, seededBetween, seededPick } from "@/lib/demo/seed";

const NAMES = [
  "Grace Wanjiku",
  "Otieno Properties",
  "Brian Kamau",
  "Amina Hassan",
  "Peter Mwangi",
  "Cynthia Achieng",
  "Samuel Kiprotich",
  "Faith Njeri",
  "Dennis Omondi",
  "Mercy Chebet",
  "Joseph Mutua",
  "Halima Yusuf",
  "Victor Wekesa",
  "Esther Kilonzo",
  "Collins Barasa",
  "Nancy Wairimu",
  "Ibrahim Abdi",
  "Ruth Moraa",
] as const;

// ------------------------------------------------------------------ payments

export type PaymentProvider = "MPESA" | "CARD";
export type PaymentPurpose = "SUBSCRIPTION" | "LISTING_BOOST" | "VERIFICATION";
export type PaymentStatus = "SUCCESS" | "PENDING" | "FAILED";

export type DemoPayment = {
  id: string;
  reference: string;
  payer: string;
  amount: number;
  provider: PaymentProvider;
  purpose: PaymentPurpose;
  status: PaymentStatus;
  createdAt: string;
};

/** Weighted so most transactions succeed; a table of failures would be misleading. */
const STATUS_POOL: PaymentStatus[] = [
  "SUCCESS",
  "SUCCESS",
  "SUCCESS",
  "SUCCESS",
  "SUCCESS",
  "SUCCESS",
  "PENDING",
  "FAILED",
];

const AMOUNTS = [1_500, 2_500, 3_500, 4_500, 7_500, 12_000] as const;

let cachedPayments: DemoPayment[] | null = null;

/**
 * 48 transactions, newest first. Cached for the life of the page so a filter
 * change re-reads the same set instead of regenerating equivalent-but-new rows.
 */
export function demoPayments(): DemoPayment[] {
  if (cachedPayments) return cachedPayments;

  cachedPayments = Array.from({ length: 48 }, (_, index) => {
    const key = `pay:${index}`;
    const provider: PaymentProvider = seededBetween(key, 0, 9) < 8 ? "MPESA" : "CARD";
    const status = seededPick(`${key}:status`, STATUS_POOL);
    return {
      id: `pmt_${String(index + 1).padStart(4, "0")}`,
      reference:
        provider === "MPESA"
          ? `S${seededBetween(`${key}:ref`, 100_000, 999_999)}${String.fromCharCode(
              65 + (index % 26),
            )}`
          : `ch_${seededBetween(`${key}:ref`, 1_000_000, 9_999_999)}`,
      payer: seededPick(`${key}:payer`, NAMES),
      amount: seededPick(`${key}:amount`, AMOUNTS),
      provider,
      purpose: seededPick<PaymentPurpose>(`${key}:purpose`, [
        "SUBSCRIPTION",
        "SUBSCRIPTION",
        "LISTING_BOOST",
        "VERIFICATION",
      ]),
      status,
      createdAt: daysAgo(Math.floor(index / 2)),
    };
  });

  return cachedPayments;
}

// ------------------------------------------------------------- subscriptions

export type PlanName = "Starter" | "Standard" | "Premium";
export type SubscriptionStatus = "ACTIVE" | "EXPIRED" | "CANCELLED";

export type DemoSubscription = {
  id: string;
  landlord: string;
  plan: PlanName;
  amount: number;
  status: SubscriptionStatus;
  startedAt: string;
  /** Past for EXPIRED rows, future for ACTIVE ones — the dates have to agree with the status. */
  expiresAt: string;
  listings: number;
};

const PLAN_PRICES: Record<PlanName, number> = {
  Starter: 1_500,
  Standard: 2_500,
  Premium: 4_500,
};

let cachedSubscriptions: DemoSubscription[] | null = null;

export function demoSubscriptions(): DemoSubscription[] {
  if (cachedSubscriptions) return cachedSubscriptions;

  cachedSubscriptions = Array.from({ length: 36 }, (_, index) => {
    const key = `sub:${index}`;
    const plan = seededPick<PlanName>(`${key}:plan`, ["Starter", "Standard", "Premium"]);
    const status = seededPick<SubscriptionStatus>(`${key}:status`, [
      "ACTIVE",
      "ACTIVE",
      "ACTIVE",
      "EXPIRED",
      "EXPIRED",
      "CANCELLED",
    ]);

    const startedDaysAgo = seededBetween(`${key}:start`, 20, 300);
    // An ACTIVE subscription must expire in the future and an EXPIRED one in the
    // past, or the table contradicts itself on the row a reader looks at hardest.
    const expiresOffset =
      status === "ACTIVE"
        ? -seededBetween(`${key}:exp`, 2, 60)
        : seededBetween(`${key}:exp`, 1, startedDaysAgo - 10);

    return {
      id: `sub_${String(index + 1).padStart(4, "0")}`,
      landlord: seededPick(`${key}:name`, NAMES),
      plan,
      amount: PLAN_PRICES[plan],
      status,
      startedAt: daysAgo(startedDaysAgo),
      expiresAt: daysAgo(expiresOffset),
      listings: seededBetween(`${key}:listings`, 1, 24),
    };
  });

  return cachedSubscriptions;
}

export const DEMO_PLANS: {
  name: PlanName;
  price: number;
  listingLimit: number;
  subscribers: number;
  features: string[];
}[] = [
  {
    name: "Starter",
    price: 1_500,
    listingLimit: 3,
    subscribers: 1_142,
    features: ["3 active listings", "Standard placement", "Email support"],
  },
  {
    name: "Standard",
    price: 2_500,
    listingLimit: 10,
    subscribers: 1_386,
    features: ["10 active listings", "Priority placement", "Basic analytics"],
  },
  {
    name: "Premium",
    price: 4_500,
    listingLimit: 40,
    subscribers: 687,
    features: ["40 active listings", "Featured placement", "Full analytics", "Phone support"],
  },
];
