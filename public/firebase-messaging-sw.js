/**
 * NyumbaLink Admin — push notification service worker.
 *
 * This worker deliberately does **not** load the Firebase SDK, which is the main
 * change from the version it replaces. Three reasons, in order of how much they hurt:
 *
 * 1. **Double notifications.** `@firebase/messaging` 12.x `onPush` shows the
 *    notification itself whenever the payload carries a `notification` block, and
 *    *then* calls `onBackgroundMessage` (see `index.sw.esm.js`, "background handling:
 *    display if possible and pass to onBackgroundMessage hook"). The backend always
 *    sends one — `services/push.js` sets `notification` *and* `webpush.notification` —
 *    so the old worker's `showNotification` inside that hook produced two toasts for
 *    every single push.
 * 2. **Clicks went nowhere.** The SDK's own `notificationclick` handler navigates only
 *    when `fcmOptions.link` or `notification.click_action` is set. The backend sends
 *    neither, so the SDK closed the notification and returned — and because it calls
 *    `stopImmediatePropagation()` on FCM-owned notifications, a custom handler added
 *    after `firebase.messaging()` could not have fixed it either.
 * 3. **Cold starts.** A service worker is torn down between pushes, so `importScripts`
 *    re-fetched ~200KB from gstatic.com on every wake. A failed fetch throws during
 *    script evaluation and the push is dropped with no trace.
 *
 * None of the SDK's remaining value applies here: FCM registration tokens are minted in
 * the page by `lib/notifications/push.ts` (`getToken` only needs *a* registration, not a
 * Firebase-aware one), and the raw webpush envelope this worker parses is exactly what
 * the SDK parses — `event.data.json()`, nothing more.
 *
 * The filename is kept so existing registrations update in place instead of stranding a
 * second worker at the same scope.
 *
 * Contract with `lib/notifications/push.ts` — keep the two in step:
 *   SW → page  {source: "nyumbalink-admin-push", type: "PUSH_RECEIVED" | "NOTIFICATION_CLICK" | "PUSH_SUBSCRIPTION_CHANGED", ...}
 *   page → SW  {type: "SKIP_WAITING"}
 */

const SOURCE = "nyumbalink-admin-push";

const DEFAULT_TITLE = "NyumbaLink Admin";
const DEFAULT_BODY = "You have a new notification.";
const ICON = "/icon-192.png";
const BADGE = "/favicon-96x96.png";

/** How long a focused tab gets to acknowledge a click before we hard-navigate it. */
const ROUTE_ACK_TIMEOUT_MS = 500;

/**
 * Where a notification type lands in the console. `data.type` is set by
 * `createNotification` in the backend; anything unmapped falls back to the
 * notification list, which can render every type.
 */
const ROUTE_BY_TYPE = {
  ADMIN_LANDLORD_PENDING: "/landlords",
  ADMIN_PAYMENT_RECEIVED: "/payments",
  ADMIN_PAYMENT_FAILED: "/payments",
  ADMIN_DUPLICATE_RECEIPT: "/payments",
  ADMIN_PROPERTY_PUBLISHED: "/properties",
  PAYMENT_SUCCESS: "/payments",
  SUBSCRIPTION_EXPIRING: "/subscriptions",
  PROPERTY_HIDDEN: "/properties",
  PROPERTY_VIEWED: "/properties",
  PROPERTY_REVIEWED: "/properties",
  NEW_MATCHING_PROPERTY: "/properties",
  SYSTEM_ALERT: "/notifications",
};

const FALLBACK_ROUTE = "/notifications";

// ---------------------------------------------------------------------------
// Lifecycle
//
// Without these two, a corrected worker sits in "waiting" until every admin tab is
// closed — which, on a console someone leaves open all day, means the broken version
// keeps handling pushes for days.
// ---------------------------------------------------------------------------

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

// ---------------------------------------------------------------------------
// Payload parsing
// ---------------------------------------------------------------------------

/**
 * FCM webpush envelope, as delivered by `services/push.js`:
 *
 *   {notification: {title, body}, data: {...}, fcmMessageId, from, priority}
 *
 * Every value in `data` is a string — `fcmData()` stringifies the bag before sending —
 * so nothing here assumes otherwise. A data-only message (no `notification` block) is
 * also handled: `title`/`body` are read out of `data`, which is what a future silent
 * push would use to update the badge without showing anything.
 */
function parsePush(event) {
  if (!event.data) return null;
  try {
    return event.data.json();
  } catch {
    // Not JSON. A plain-text push isn't something this backend sends, but showing it
    // beats dropping it silently.
    const text = event.data.text();
    return text ? { notification: { body: text } } : null;
  }
}

function normalize(payload) {
  const notification = payload.notification ?? {};
  const data = payload.data ?? {};

  return {
    title: notification.title || data.title || DEFAULT_TITLE,
    body: notification.body || data.body || DEFAULT_BODY,
    type: data.type || notification.type || "SYSTEM_ALERT",
    notificationId: data.notificationId || payload.fcmMessageId || null,
    data,
    link: payload.fcmOptions?.link || data.click_action || data.link || null,
    /** A data-only push with nothing to say is a badge refresh, not a notification. */
    silent: data.silent === "true",
  };
}

/**
 * Same-origin path to open on click. External links are dropped rather than followed:
 * a notification is not a place to accept an arbitrary redirect target from.
 */
function targetPath(message) {
  if (message.link) {
    try {
      const url = new URL(message.link, self.location.origin);
      if (url.origin === self.location.origin) return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      // Malformed link — fall through to the type map.
    }
  }
  return ROUTE_BY_TYPE[message.type] ?? FALLBACK_ROUTE;
}

function notificationOptions(message, path) {
  return {
    body: message.body,
    icon: ICON,
    badge: BADGE,
    // Tagging on the notification id means a redelivered push (FCM retries, or a
    // reconcile replaying the same settlement) replaces its predecessor instead of
    // stacking. `renotify` keeps the replacement from being silent.
    tag: message.notificationId ? `notification:${message.notificationId}` : `type:${message.type}`,
    renotify: true,
    timestamp: Date.now(),
    data: { ...message.data, type: message.type, notificationId: message.notificationId, path },
  };
}

// ---------------------------------------------------------------------------
// Push
// ---------------------------------------------------------------------------

function windowClients() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true });
}

/**
 * Mirrors the SDK's own rule: a visible tab gets the payload and decides for itself
 * (toast + badge refresh), and only a backgrounded console gets an OS notification.
 * An operator watching the payments table does not need a system toast telling them
 * about the row they are looking at.
 */
function hasVisibleClient(clients) {
  return clients.some(
    (client) => client.visibilityState === "visible" && !client.url.startsWith("chrome-extension://"),
  );
}

async function handlePush(event) {
  const payload = parsePush(event);
  if (!payload) return;

  const message = normalize(payload);
  const path = targetPath(message);
  const clients = await windowClients();

  // Always tell open tabs, visible or not — this is what moves the unread badge
  // without waiting out the provider's 60-second poll.
  for (const client of clients) {
    client.postMessage({
      source: SOURCE,
      type: "PUSH_RECEIVED",
      title: message.title,
      body: message.body,
      notificationType: message.type,
      notificationId: message.notificationId,
      path,
      data: message.data,
    });
  }

  if (message.silent) return;
  if (hasVisibleClient(clients)) return;

  await self.registration.showNotification(message.title, notificationOptions(message, path));
}

self.addEventListener("push", (event) => {
  event.waitUntil(handlePush(event));
});

// ---------------------------------------------------------------------------
// Click
// ---------------------------------------------------------------------------

/**
 * Route a focused tab to `path`.
 *
 * The fast path is a message the app's `NotificationProvider` turns into a router
 * navigation — no reload, no lost table state. The acknowledgement round-trip exists
 * so this worker still works correctly when it is newer than the bundle in that tab
 * (a deploy an operator hasn't reloaded into yet): an unanswered message means nothing
 * is listening, so fall back to a real navigation.
 */
async function routeClient(client, path) {
  const acknowledged = await new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve(false), ROUTE_ACK_TIMEOUT_MS);
    channel.port1.onmessage = () => {
      clearTimeout(timer);
      resolve(true);
    };
    try {
      client.postMessage({ source: SOURCE, type: "NOTIFICATION_CLICK", path }, [channel.port2]);
    } catch {
      clearTimeout(timer);
      resolve(false);
    }
  });

  if (acknowledged) return;
  if (typeof client.navigate !== "function") return;
  try {
    await client.navigate(new URL(path, self.location.origin).href);
  } catch {
    // Chrome refuses `navigate()` on a client it doesn't control. Leaving the tab
    // focused on the wrong screen is a poor outcome but not a broken one.
  }
}

async function handleNotificationClick(event) {
  event.notification.close();

  const path = event.notification.data?.path ?? FALLBACK_ROUTE;
  const clients = await windowClients();
  const sameOrigin = clients.filter((client) => {
    try {
      return new URL(client.url).origin === self.location.origin;
    } catch {
      return false;
    }
  });

  // Prefer a tab the operator can already see, so the console doesn't surface behind
  // whatever else they had focused.
  const target =
    sameOrigin.find((client) => client.visibilityState === "visible") ?? sameOrigin[0];

  if (!target) {
    await self.clients.openWindow(new URL(path, self.location.origin).href);
    return;
  }

  const focused = (typeof target.focus === "function" ? await target.focus() : null) ?? target;
  await routeClient(focused, path);
}

self.addEventListener("notificationclick", (event) => {
  // An action button is a different intent than opening the console; none are declared
  // today, so ignore rather than guess.
  if (event.action) return;
  event.waitUntil(handleNotificationClick(event));
});

// ---------------------------------------------------------------------------
// Subscription rotation
// ---------------------------------------------------------------------------

/**
 * The browser can retire a push subscription on its own (storage pressure, key
 * rotation), which silently invalidates the FCM token the backend has on file — the
 * admin then stops receiving push with nothing anywhere to say why.
 *
 * Minting the replacement needs the Firebase config and a session, so it has to happen
 * in the page. With no tab open there is nothing to do here: `NotificationProvider`
 * re-runs registration on every load where permission is already granted, which
 * repairs it at the next visit.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    windowClients().then((clients) => {
      for (const client of clients) {
        client.postMessage({ source: SOURCE, type: "PUSH_SUBSCRIPTION_CHANGED" });
      }
    }),
  );
});
