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

// webpush.notification in the FCM payload handles displaying the notification.
// onBackgroundMessage is only needed if we want to customize beyond what the payload provides.
messaging.onBackgroundMessage(() => {
  // No-op: notification is shown automatically by webpush.notification payload
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
