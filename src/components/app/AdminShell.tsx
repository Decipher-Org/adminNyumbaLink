import { useState } from "react";
import { Bell, LogOut, Menu, ShieldCheck } from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import {
  ADMIN_NAV,
  STATUS_LEGEND,
  type NavItem,
} from "@/components/app/nav-config";
import { Logo, LogoMark } from "@/components/brand/Logo";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useNotifications } from "@/lib/notifications/NotificationProvider";
import { initials } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The console chrome.
 *
 * Responsive rule, from the design sheet: a persistent dark sidebar from `lg` up,
 * and a bottom tab bar below it — the same navigation, not a reduced one. A tab bar
 * holds five touch targets at 360px; there are ten destinations, so the fifth slot
 * is a "More" button that opens the full list in a sheet. Nothing here is
 * desktop-only, which matters because approving a landlord is exactly the kind of
 * task someone does from a phone.
 *
 * The sidebar is the one surface in this app that ignores the shared palette and
 * uses its own `--sidebar-*` tokens. That is deliberate: an operator often has this
 * console and the tenant app open against the same backend, and a dark green rail
 * makes it impossible to act on the wrong one by mistake.
 */

function NavBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 py-0.5 text-[11px] leading-none font-semibold text-white tabular-nums">
      {count > 99 ? "99+" : count}
    </span>
  );
}

function SidebarLink({
  item,
  badge = 0,
  onNavigate,
}: {
  item: NavItem;
  badge?: number;
  onNavigate?: () => void;
}) {
  const { icon: Icon, label, to } = item;

  return (
    <NavLink
      to={to}
      // `end` only on the dashboard: every other path is a leaf, but "/" is a
      // prefix of all of them and would otherwise stay highlighted everywhere.
      end={to === "/"}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-body-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-muted hover:bg-white/8 hover:text-sidebar-foreground",
        )
      }
    >
      <Icon className="size-4.5 shrink-0" />
      <span className="truncate">{label}</span>
      {badge > 0 ? <NavBadge count={badge} /> : null}
    </NavLink>
  );
}

/** The "Admin User / Super Administrator" card at the top of the rail. */
function OperatorCard({ name, email }: { name: string; email: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl bg-white/8 px-3 py-2.5">
      <Avatar className="size-9 shrink-0">
        <AvatarFallback className="bg-sidebar-accent text-body-sm font-semibold text-sidebar-accent-foreground">
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="truncate text-body-sm font-semibold text-sidebar-foreground">
          {name}
        </p>
        <p className="flex items-center gap-1 truncate text-caption text-sidebar-muted">
          <ShieldCheck aria-hidden="true" className="size-3 shrink-0" />
          Administrator
        </p>
        <p className="sr-only">{email}</p>
      </div>
    </div>
  );
}

function StatusLegend() {
  return (
    <div className="rounded-xl border border-sidebar-border px-3 py-2.5">
      <p className="text-caption font-semibold text-sidebar-muted uppercase">
        Status key
      </p>
      <ul className="mt-2 grid grid-cols-2 gap-1.5">
        {STATUS_LEGEND.map((entry) => (
          <li
            key={entry.label}
            className="flex items-center gap-2 text-caption text-sidebar-muted"
          >
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-full", entry.className)}
            />
            {entry.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/** The four-point band under every screen, from the design sheet's footer. */
function FooterBand() {
  const points = [
    {
      title: "Centralised management",
      body: "Users, landlords and listings in one console.",
    },
    {
      title: "Secure & reliable",
      body: "Every action is behind an administrator session.",
    },
    {
      title: "Real-time insights",
      body: "Counts read straight from the live database.",
    },
    {
      title: "Grow your platform",
      body: "Approve landlords fast to keep supply moving.",
    },
  ];

  return (
    <footer className="mt-10 border-t border-border pt-6">
      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {points.map((point) => (
          <li key={point.title}>
            <p className="text-body-sm font-semibold text-foreground">
              {point.title}
            </p>
            <p className="mt-0.5 text-caption text-muted-foreground">
              {point.body}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-caption text-muted-foreground">
        NyumbaLink Admin · internal use only
      </p>
    </footer>
  );
}

export function AdminShell() {
  const { user, signOut } = useAuth();
  const { unreadCount } = useNotifications();
  const navigate = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const badges: Record<string, number> = {
    "/notifications": unreadCount,
  };

  async function handleSignOut() {
    await signOut();
    navigate("/login", { replace: true });
  }

  const name = user?.name ?? "Administrator";
  const email = user?.email ?? "";

  return (
    <TooltipProvider delayDuration={200}>
      <div className="min-h-screen bg-background">
        {/* Sidebar — lg and up. */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col bg-sidebar lg:flex">
          <div className="px-4 py-5">
            <Link to="/" className="inline-flex" aria-label="Admin dashboard">
              <Logo onDark />
            </Link>
          </div>

          <div className="px-3">
            <OperatorCard name={name} email={email} />
          </div>

          <nav
            aria-label="Main"
            className="mt-4 flex flex-1 flex-col gap-1 overflow-y-auto px-3"
          >
            {ADMIN_NAV.map((item) => (
              <SidebarLink
                key={item.to}
                item={item}
                badge={badges[item.to] ?? 0}
              />
            ))}
          </nav>

          <div className="space-y-3 p-3">
            <StatusLegend />
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 text-sidebar-muted hover:bg-white/8 hover:text-sidebar-foreground"
              onClick={handleSignOut}
            >
              <LogOut className="size-4.5" />
              Sign out
            </Button>
          </div>
        </aside>

        <div className="lg:pl-64">
          <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-border bg-card/95 px-4 backdrop-blur sm:px-6">
            <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="lg:hidden"
                  aria-label="Open navigation"
                >
                  <Menu />
                </Button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-[19rem] gap-0 overflow-y-auto bg-sidebar p-0 text-sidebar-foreground"
              >
                <SheetTitle className="sr-only">Navigation</SheetTitle>
                <div className="px-4 py-5">
                  <Logo onDark />
                </div>
                <div className="px-3">
                  <OperatorCard name={name} email={email} />
                </div>
                <nav
                  aria-label="All sections"
                  className="mt-4 flex flex-col gap-1 px-3"
                >
                  {ADMIN_NAV.map((item) => (
                    <SidebarLink
                      key={item.to}
                      item={item}
                      badge={badges[item.to] ?? 0}
                      onNavigate={() => setSheetOpen(false)}
                    />
                  ))}
                </nav>
                <div className="mt-4 space-y-3 p-3">
                  <StatusLegend />
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-3 text-sidebar-muted hover:bg-white/8 hover:text-sidebar-foreground"
                    onClick={handleSignOut}
                  >
                    <LogOut className="size-4.5" />
                    Sign out
                  </Button>
                </div>
              </SheetContent>
            </Sheet>

            <Link to="/" className="lg:hidden" aria-label="Admin dashboard">
              <LogoMark className="size-8" />
            </Link>

            <div className="ml-auto flex items-center gap-1 sm:gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => navigate("/notifications")}
                aria-label={
                  unreadCount > 0
                    ? `Notifications, ${unreadCount} unread`
                    : "Notifications"
                }
              >
                <Bell className="size-5" />
                {unreadCount > 0 ? (
                  <span
                    aria-hidden="true"
                    className="absolute -top-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground"
                  >
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </Button>

              <div className="hidden text-right sm:block">
                <p className="text-body-sm font-semibold text-foreground">
                  {name}
                </p>
                <p className="text-caption text-muted-foreground">
                  Administrator
                </p>
              </div>
              <Avatar className="size-9">
                <AvatarFallback className="bg-secondary text-body-sm font-semibold text-secondary-foreground">
                  {initials(name)}
                </AvatarFallback>
              </Avatar>
            </div>
          </header>

          {/* pb-24 keeps the last row clear of the fixed bottom tab bar. */}
          <main className="mx-auto w-full max-w-7xl px-4 py-6 pb-24 sm:px-6 lg:px-8 lg:pb-10">
            <Outlet />
            <FooterBand />
          </main>
        </div>

        {/* Bottom tab bar — below lg. `env(safe-area-inset-bottom)` keeps the tabs
            clear of the iOS home indicator, which would otherwise sit on them. */}
        <nav
          aria-label="Sections"
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          <ul className="flex">
            {ADMIN_NAV.filter((item) => item.primary)
              .slice(0, 4)
              .map(({ to, label, icon: Icon }) => (
                <li key={to} className="flex-1">
                  <NavLink
                    to={to}
                    end={to === "/"}
                    className={({ isActive }) =>
                      cn(
                        "relative flex min-h-14 flex-col items-center justify-center gap-1 px-1 py-2 text-caption font-medium transition-colors",
                        isActive ? "text-primary" : "text-muted-foreground",
                      )
                    }
                  >
                    <Icon className="size-5" />
                    <span className="truncate">{label}</span>
                    {badges[to] > 0 ? (
                      <span
                        aria-hidden="true"
                        className="absolute top-2 right-1/4 size-1.5 rounded-full bg-destructive"
                      />
                    ) : null}
                  </NavLink>
                </li>
              ))}
          </ul>
        </nav>
      </div>
    </TooltipProvider>
  );
}
