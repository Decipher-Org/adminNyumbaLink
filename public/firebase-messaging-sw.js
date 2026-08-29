/* Firebase receives this public configuration through the registration URL. */
importScripts(
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js",
  "https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js",
);

const params = new URL(self.location.href).searchParams;
const config = {
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
};

if (Object.values(config).every(Boolean)) {
  firebase.initializeApp(config);
  const messaging = firebase.messaging();
  messaging.onBackgroundMessage((payload) => {
    const notification = payload.notification || {};
    self.registration.showNotification(
      notification.title || "NyumbaLink Admin",
      {
        body: notification.body || "You have a new notification.",
        data: payload.data || {},
      },
    );
  });
}
