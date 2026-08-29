import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AdminShell } from "@/components/app/AdminShell";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "@/lib/auth/AuthProvider";
import { GuestOnlyRoute, ProtectedRoute } from "@/lib/auth/ProtectedRoute";
import { NotificationProvider } from "@/lib/notifications/NotificationProvider";
import Analytics from "@/pages/Analytics";
import Dashboard from "@/pages/Dashboard";
import Landlords from "@/pages/Landlords";
import Login from "@/pages/Login";
import NotFound from "@/pages/NotFound";
import Notifications from "@/pages/Notifications";
import Payments from "@/pages/Payments";
import Properties from "@/pages/Properties";
import Reports from "@/pages/Reports";
import Settings from "@/pages/Settings";
import Subscriptions from "@/pages/Subscriptions";
import Users from "@/pages/Users";

/**
 * Routes.
 *
 * Every screen sits behind `ProtectedRoute` and inside `AdminShell` — there is no
 * public area of this app and no signed-in screen without the navigation. Pages are
 * imported eagerly rather than lazily: the whole bundle is about the size of one
 * hero image, and an operator moving between the queue and a user record shouldn't
 * wait on a chunk fetch on a bad connection.
 */
export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<GuestOnlyRoute />}>
              <Route path="/login" element={<Login />} />
            </Route>

            <Route element={<ProtectedRoute />}>
              <Route element={<AdminShell />}>
                <Route index element={<Dashboard />} />
                <Route path="landlords" element={<Landlords />} />
                <Route path="users" element={<Users />} />
                <Route path="properties" element={<Properties />} />
                <Route path="payments" element={<Payments />} />
                <Route path="subscriptions" element={<Subscriptions />} />
                <Route path="reports" element={<Reports />} />
                <Route path="analytics" element={<Analytics />} />
                <Route path="notifications" element={<Notifications />} />
                <Route path="settings" element={<Settings />} />
                <Route path="*" element={<NotFound />} />
              </Route>
            </Route>
          </Routes>
        </BrowserRouter>
      </NotificationProvider>

      {/* Bottom-centre on a phone would collide with the tab bar, so toasts stay
          top-right on every breakpoint. */}
      <Toaster position="top-right" />
    </AuthProvider>
  );
}
