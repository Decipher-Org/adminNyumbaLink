import {
  registerDeviceToken,
  unregisterDeviceToken,
} from "@/lib/api/notifications";
import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { deleteToken, getMessaging, getToken } from "firebase/messaging";

/**
 * Browser push for the admin console.
 *
 * Firebase is used here for exactly one thing: minting an FCM registration token to
 * hand the backend. Everything about *receiving* a push lives in
 * `public/firebase-messaging-sw.js`, which no longer loads the Firebase SDK — see the
 * header comment there for why. That split is why `onMessage` is gone from this file:
 * the worker posts straight to the page, so foreground pushes no longer depend on the
 * SDK being present in the worker, and no longer render through `new Notification()`
 * (an illegal constructor on Android Chrome, and unclickable everywhere).
 */

export type PushState =
  | "unsupported"
  | "unconfigured"
  | "default"
  | "denied"
  | "enabled";

/** Messages the service worker sends the page. Mirrors the contract documented there. */
export type PushMessage =
  | {
      type: "PUSH_RECEIVED";
      title: string;
      body: string;
      notificationType: string;
      notificationId: string | null;
      path: string;
      data: Record<string, string>;
    }
  | { type: "NOTIFICATION_CLICK"; path: string }
  | { type: "PUSH_SUBSCRIPTION_CHANGED" };

const SW_SOURCE = "nyumbalink-admin-push";
const SW_URL = "/firebase-messaging-sw.js";

/** The token last handed to the backend, so sign-out can withdraw the right one. */
let registeredToken: string | null = null;

function firebaseConfig(): FirebaseOptions | null {
  const config = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
  return Object.values(config).every(Boolean) ? config : null;
}

export function currentPushState(): PushState {
  if (!("Notification" in window) || !("serviceWorker" in navigator)) return "unsupported";
  if (!firebaseConfig() || !import.meta.env.VITE_FIREBASE_VAPID_KEY) return "unconfigured";
  if (Notification.permission === "granted") return "enabled";
  if (Notification.permission === "denied") return "denied";
  return "default";
}

function messaging() {
  const config = firebaseConfig();
  if (!config) throw new Error("Firebase Messaging is not configured.");
  const app = getApps().length > 0 ? getApp() : initializeApp(config);
  return getMessaging(app);
}

/**
 * Registered at the root scope and with no query string.
 *
 * The previous version passed the Firebase config through the registration URL, which
 * meant one missing environment variable left a worker installed and permanently inert
 * — it ignored every push, silently, because its `every(Boolean)` guard failed. The
 * worker needs no configuration now, so that failure mode is gone. Same scope as
 * before, so the browser updates the existing registration in place rather than
 * leaving two workers behind.
 */
function messagingServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register(SW_URL);
}

// ---------------------------------------------------------------------------
// Worker → page messages
// ---------------------------------------------------------------------------

type Handler = (message: PushMessage) => void;

const handlers = new Set<Handler>();
let transportInstalled = false;

function installTransport() {
  if (transportInstalled || !("serviceWorker" in navigator)) return;
  transportInstalled = true;

  navigator.serviceWorker.addEventListener("message", (event: MessageEvent) => {
    const payload = event.data;
    // The Firebase SDK puts its own messages on this channel too. Only ours carry
    // this marker, and ignoring the rest keeps the two from being confused.
    if (payload?.source !== SW_SOURCE) return;

    // The worker waits on this before deciding whether it needs to hard-navigate the
    // tab, so acknowledge only when something is actually listening to route it.
    if (payload.type === "NOTIFICATION_CLICK" && handlers.size > 0) {
      event.ports?.[0]?.postMessage({ handled: true });
    }

    for (const handler of handlers) {
      try {
        handler(payload as PushMessage);
      } catch {
        // One bad subscriber must not stop the others from seeing the message.
      }
    }
  });
}

/** Subscribe to service worker push events. Returns an unsubscribe function. */
export function onPushMessage(handler: Handler): () => void {
  installTransport();
  handlers.add(handler);
  return () => handlers.delete(handler);
}

// ---------------------------------------------------------------------------
// Enable / disable
// ---------------------------------------------------------------------------

/** Requests permission, obtains an FCM token, and registers it with PropertyHub. */
export async function enablePushNotifications(): Promise<void> {
  if (currentPushState() === "unsupported") {
    throw new Error("This browser does not support push notifications.");
  }
  if (currentPushState() === "unconfigured") {
    throw new Error("Push notifications are not configured for this environment.");
  }
  if (Notification.permission === "denied") {
    throw new Error("Notifications are blocked in your browser settings.");
  }

  const permission =
    Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();
  if (permission !== "granted") {
    throw new Error("Notification permission was not granted.");
  }

  const config = firebaseConfig();
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!config || !vapidKey) throw new Error("Push notifications are not configured.");

  const [firebaseMessaging, registration] = await Promise.all([
    Promise.resolve(messaging()),
    messagingServiceWorker(),
  ]);
  const token = await getToken(firebaseMessaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Firebase did not return a browser notification token.");

  installTransport();
  await registerDeviceToken(token, "web");
  registeredToken = token;
}

/**
 * Withdraw this browser's token on sign-out.
 *
 * Not housekeeping — a token left on file is owned by the admin who registered it, and
 * `registerDeviceToken` answers `DEVICE_TOKEN_OWNED_BY_ANOTHER_USER` (403) when someone
 * else's browser presents it. On a shared ops workstation that means the *second* admin
 * to sign in never registers, and never receives a push, until the row is cleared by
 * hand. Deleting the FCM token as well means the next sign-in mints a fresh one rather
 * than re-presenting the contested one.
 *
 * Failures are swallowed: the caller is signing out either way, and the token expires
 * on its own.
 */
export async function disablePushNotifications(): Promise<void> {
  const token = registeredToken;
  registeredToken = null;
  if (!token) return;

  try {
    await unregisterDeviceToken(token);
  } catch {
    // Server-side row survives; it will be reclaimed when this browser registers again
    // as the same user, or cleared by FCM rejecting the stale token on the next send.
  }

  try {
    await deleteToken(messaging());
  } catch {
    // Nothing further to try — the local token is discarded regardless.
  }
}
