/* eslint-disable no-undef */

// Handle push notifications manually for full control
self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data = {};
  let title = "VentIA";
  let body = "Tienes una nueva notificación";

  try {
    const payload = event.data.json();
    data = payload.data || {};
    title = payload.notification?.title || data.title || title;
    body = payload.notification?.body || data.body || body;
  } catch (e) {
    // If not JSON, use text
    body = event.data.text();
  }

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
