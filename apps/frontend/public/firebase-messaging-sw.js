/* eslint-disable no-undef */

// IMPORTANT: Register click handler BEFORE Firebase SDK to prevent
// Firebase's internal handler from calling stopImmediatePropagation()
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.stopImmediatePropagation();

  const data = event.notification.data || {};
  // FCM wraps data in FCM_MSG.data when using notification payload
  const fcmData = data.FCM_MSG?.data || data;
  const link = fcmData.click_action || data.fcmOptions?.link || "/dashboard/conversations";

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
