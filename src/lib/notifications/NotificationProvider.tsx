/**
 * Notification state for the admin console: the unread count displayed in the shell bell and sidebar.
 *
 * The provider polls `GET /notifications?unreadOnly=true&limit=1` every 60
 * seconds to refresh the badge. This is a single lightweight request that
 * returns one row and a `pagination.total` — far cheaper than fetching the full
 * notification list.
 *
 * Polling is used because the backend has no WebSocket support. 60 seconds is a
 * reasonable interval: notifications here are not time-critical (payment
 * receipts, property approvals). The full notification page always fetches the
 * latest on mount regardless of the poll.
 *
 * The provider checks `user !== null` before polling, so it is safe to mount at
 * the root without gating on auth — it simply idles for guests.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { getUnreadCount } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  currentPushState,
  enablePushNotifications,
} from "@/lib/notifications/push";

const POLL_INTERVAL_MS = 60_000;

type NotificationState = {
  /** Number of unread notifications for the current authenticated admin. */
  unreadCount: number;
  /** Trigger an immediate refresh of the unread count (e.g. after mark-as-read). */
  refreshUnreadCount: () => void;
};

const NotificationContext = createContext<NotificationState | undefined>(
  undefined,
);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchCount = useCallback(async () => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    try {
      const count = await getUnreadCount();
      setUnreadCount(count);
    } catch {
      // Swallow — a failed badge poll is not worth surfacing. The next tick
      // will retry, and the notification page itself always fetches fresh.
    }
  }, [user]);

  // Fetch once on mount / user change, then start polling.
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }

    // Immediate first fetch.
    void fetchCount();

    intervalRef.current = setInterval(() => {
      void fetchCount();
    }, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, fetchCount]);

  // Permission prompts must follow a user gesture, but a browser that was
  // already granted permission can silently refresh its FCM registration token
  // when the admin returns to the app.
  useEffect(() => {
    if (!user || currentPushState() !== "enabled") return;
    void enablePushNotifications().catch(() => {
      // The Notifications page exposes a retryable explanation when registration fails.
    });
  }, [user]);

  const refreshUnreadCount = useCallback(() => {
    void fetchCount();
  }, [fetchCount]);

  return (
    <NotificationContext.Provider value={{ unreadCount, refreshUnreadCount }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationState {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error(
      "useNotifications must be used inside <NotificationProvider>",
    );
  }
  return context;
}
