/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

// Read Firebase config from query parameters (passed at registration time)
const params = new URL(location).searchParams;

firebase.initializeApp({
  apiKey: params.get("apiKey"),
  authDomain: params.get("authDomain"),
  projectId: params.get("projectId"),
  storageBucket: params.get("storageBucket"),
  messagingSenderId: params.get("messagingSenderId"),
  appId: params.get("appId"),
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || payload.data?.title || "VentIA";
  const body = payload.notification?.body || payload.data?.body || "Tienes una nueva notificación";
  const data = payload.data || {};

  self.registration.showNotification(title, {
    body: body,
    icon: "/images/logo-icon.png",
    badge: "/images/logo-icon.png",
    data: data,
    tag: "ventia-" + (data.conversation_id || "general"),
    vibrate: [200, 100, 200],
  });
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const clickAction = event.notification.data?.click_action || "/dashboard/conversations";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          return client.focus().then((c) => c.navigate(clickAction));
        }
      }
      return clients.openWindow(clickAction);
    })
  );
});
