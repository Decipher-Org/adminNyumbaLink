/**
 * The admin console's navigation.
 *
 * `demo` marks a destination whose screen is sample data — the shell renders a
 * small dot on those items, so the nav itself is honest about what works rather
 * than the operator finding out after the click.
 *
 * `primary` picks the four items that get a slot in the mobile tab bar; the fifth
 * slot is a "More" button that opens the full list, so nothing is desktop-only.
 */

import {
  BarChart3,
  ClipboardList,
  Bell,
  Building2,
  CreditCard,
  Flag,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import type { ComponentType } from "react";

import type { DemoFeatureId } from "@/lib/demo/registry";

export type NavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  /** Present when the destination is sample data. */
  demo?: DemoFeatureId;
  /** Gets a slot in the mobile tab bar. Keep this to four. */
  primary?: boolean;
  /** One line, shown in the mobile sheet where there is room for it. */
  hint?: string;
};

export const ADMIN_NAV: NavItem[] = [
  {
    to: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    primary: true,
    hint: "Live counts and platform trends",
  },
  {
    to: "/landlords",
    label: "Landlords",
    icon: ShieldCheck,
    primary: true,
    hint: "Approve new landlords",
  },
  {
    to: "/users",
    label: "Users",
    icon: Users,
    primary: true,
    hint: "Roles and suspensions",
  },
  {
    to: "/properties",
    label: "Properties",
    icon: Building2,
    primary: true,
    hint: "Live listings across the platform",
  },
  {
    to: "/payments",
    label: "Payments",
    icon: CreditCard,
    hint: "M-Pesa transactions and revenue",
  },
  {
    to: "/subscriptions",
    label: "Subscriptions",
    icon: Wallet,
    hint: "Listing terms and expiry",
  },
  {
    to: "/reports",
    label: "Reports",
    icon: Flag,
    hint: "Reported listings",
  },
  {
    to: "/audit-logs",
    label: "Audit log",
    icon: ClipboardList,
    hint: "Administrative action history",
  },
  {
    to: "/analytics",
    label: "Analytics",
    icon: BarChart3,
    demo: "analytics",
    hint: "Traffic and engagement",
  },
  {
    to: "/notifications",
    label: "Notifications",
    icon: Bell,
    hint: "Platform alerts",
  },
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
    demo: "platformSettings",
    hint: "Your account and platform configuration",
  },
];

/**
 * The status legend from the design sheet, pinned in the sidebar.
 *
 * It earns its space because this console uses one colour vocabulary across six
 * unrelated status sets — an account, an approval, a listing, a payment, a
 * subscription, a report. The legend is what makes green mean the same thing in
 * all six.
 */
export const STATUS_LEGEND: { label: string; className: string }[] = [
  { label: "Active", className: "bg-success" },
  { label: "Inactive", className: "bg-inactive" },
  { label: "Pending", className: "bg-warning" },
  { label: "Suspended", className: "bg-destructive" },
];
