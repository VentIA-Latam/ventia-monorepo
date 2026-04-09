/* eslint-disable no-undef */
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/11.6.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyCeT7BBrfRklxgq_6yVLjePdblrQ1aUkMw",
  authDomain: "ventia-app-web.firebaseapp.com",
  projectId: "ventia-app-web",
  storageBucket: "ventia-app-web.firebasestorage.app",
  messagingSenderId: "388851694307",
  appId: "1:388851694307:web:adf982ea887f4d4bcae3d6",
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  if (payload.data && payload.data.title) {
    self.registration.showNotification(payload.data.title, {
      body: payload.data.body || "",
      icon: "/images/logo-icon.png",
      badge: "/images/logo-icon.png",
      tag: "ventia-" + (payload.data.conversation_id || "general"),
      vibrate: [200, 100, 200],
      data: payload.data,
    });
  }
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
