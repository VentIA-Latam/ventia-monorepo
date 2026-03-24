import { NextResponse } from "next/server";

export async function GET() {
  const sw = `
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "${process.env.NEXT_PUBLIC_FIREBASE_API_KEY || ""}",
  authDomain: "${process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || ""}",
  projectId: "${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || ""}",
  storageBucket: "${process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || ""}",
  messagingSenderId: "${process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || ""}",
  appId: "${process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ""}",
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
`;

  return new NextResponse(sw.trim(), {
    headers: {
      "Content-Type": "application/javascript",
      "Service-Worker-Allowed": "/",
      "Cache-Control": "no-cache",
    },
  });
}
