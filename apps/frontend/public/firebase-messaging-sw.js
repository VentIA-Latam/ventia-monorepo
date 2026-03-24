/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

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

// Handle push manually to have full control over notification display and click
self.addEventListener("push", (event) => {
  if (!event.data) return;

  const payload = event.data.json();
  const notification = payload.notification || {};
  const data = payload.data || {};

  const title = notification.title || data.title || "VentIA";
  const body = notification.body || data.body || "Tienes una nueva notificación";

  event.waitUntil(
    self.registration.showNotification(title, {
      body: body,
      icon: "/images/logo-icon.png",
      badge: "/images/logo-icon.png",
      tag: "ventia-" + (data.conversation_id || "general"),
      vibrate: [200, 100, 200],
      data: data,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const link = data.click_action || "/dashboard/conversations";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/dashboard") && "focus" in client) {
          return client.focus().then((c) => c.navigate(link));
        }
      }
      return clients.openWindow(link);
    })
  );
});
