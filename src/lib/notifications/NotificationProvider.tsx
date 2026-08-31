/**
 * Notification state for the admin console: the unread count displayed in the shell bell and sidebar.
 *
 * Two things keep the badge current.
 *
 * **The service worker**, which posts every push straight to this provider — so a
 * notification that arrives while the console is open moves the badge immediately, and
 * clicking an OS notification routes the existing tab instead of reloading it. See
 * `public/firebase-messaging-sw.js` for the message contract; the acknowledgement the
 * worker waits for is sent by `lib/notifications/push.ts` on this provider's behalf.
 *
 * **A 60-second poll** of `GET /notifications?unreadOnly=true&limit=1`, which is the
 * floor when push is unavailable — permission denied, an unconfigured environment, or a
 * notification the backend created without a push channel. It is one lightweight request
 * returning a single row and a `pagination.total`, far cheaper than the full list. The
 * backend has no WebSocket support, and these notifications are not time-critical to the
 * second, so a minute is a reasonable interval.
 *
 * The provider checks `user !== null` before polling, so it is safe to mount at the root
 * without gating on auth — it simply idles for guests.
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
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { getUnreadCount } from "@/lib/api/notifications";
import { useAuth } from "@/lib/auth/AuthProvider";
import {
  currentPushState,
  enablePushNotifications,
  onPushMessage,
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
  const navigate = useNavigate();
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

  /**
   * Live push handling.
   *
   * Subscribed regardless of `user` so a click on a notification still routes after the
   * session has lapsed — `ProtectedRoute` sends them to the login screen and back,
   * which beats a click that appears to do nothing.
   */
  useEffect(() => {
    return onPushMessage((message) => {
      switch (message.type) {
        case "PUSH_RECEIVED": {
          void fetchCount();
          // The worker only suppresses the OS notification for a *visible* tab, so this
          // toast is the visible tab's replacement for it — and would be talking to an
          // empty room in any other tab.
          if (document.visibilityState !== "visible") return;
          toast(message.title, {
            description: message.body,
            action: {
              label: "View",
              onClick: () => navigate(message.path),
            },
          });
          return;
        }

        case "NOTIFICATION_CLICK":
          navigate(message.path);
          return;

        case "PUSH_SUBSCRIPTION_CHANGED":
          // The browser retired this subscription, so the token the backend holds is
          // dead. Mint a replacement while a tab is open to do it in.
          if (!user || currentPushState() !== "enabled") return;
          void enablePushNotifications().catch(() => {
            // Next load retries via the effect above.
          });
          return;
      }
    });
  }, [fetchCount, navigate, user]);

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
