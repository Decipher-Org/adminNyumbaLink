import { registerDeviceToken } from "@/lib/api/notifications";
import { getApp, getApps, initializeApp, type FirebaseOptions } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

export type PushState =
  | "unsupported"
  | "unconfigured"
  | "default"
  | "denied"
  | "enabled";

let foregroundListenerInstalled = false;

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

function installForegroundListener() {
  if (foregroundListenerInstalled) return;
  foregroundListenerInstalled = true;
  onMessage(messaging(), (payload) => {
    const notification = payload.notification;
    if (Notification.permission !== "granted" || !notification) return;
    new Notification(notification.title ?? "NyumbaLink", {
      body: notification.body,
      data: payload.data,
    });
  });
}

async function messagingServiceWorker(config: FirebaseOptions): Promise<ServiceWorkerRegistration> {
  const params = new URLSearchParams({
    apiKey: config.apiKey ?? "",
    authDomain: config.authDomain ?? "",
    projectId: config.projectId ?? "",
    storageBucket: config.storageBucket ?? "",
    messagingSenderId: config.messagingSenderId ?? "",
    appId: config.appId ?? "",
  });
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
}

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
    messagingServiceWorker(config),
  ]);
  const token = await getToken(firebaseMessaging, {
    vapidKey,
    serviceWorkerRegistration: registration,
  });
  if (!token) throw new Error("Firebase did not return a browser notification token.");
  installForegroundListener();
  await registerDeviceToken(token, "web");
}