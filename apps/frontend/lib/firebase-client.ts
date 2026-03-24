let messagingInstance: ReturnType<typeof import("firebase/messaging").getMessaging> | null = null;

async function getFirebaseMessaging() {
  if (messagingInstance) return messagingInstance;

  const { initializeApp, getApps, getApp } = await import("firebase/app");
  const { getMessaging } = await import("firebase/messaging");

  const app =
    getApps().length === 0
      ? initializeApp({
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
        })
      : getApp();

  messagingInstance = getMessaging(app);
  return messagingInstance;
}

export async function requestNotificationPermission(): Promise<string | null> {
  if (typeof window === "undefined") return null;
  if (!("Notification" in window)) return null;

  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return null;

    const sw = await navigator.serviceWorker.register("/firebase-messaging-sw.js");
    await navigator.serviceWorker.ready;

    const messaging = await getFirebaseMessaging();
    const { getToken, deleteToken } = await import("firebase/messaging");

    // Force fresh token to avoid stale UNREGISTERED tokens
    try { await deleteToken(messaging); } catch { /* ignore if no existing token */ }

    const token = await getToken(messaging, {
      vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
      serviceWorkerRegistration: sw,
    });

    return token;
  } catch (err) {
    console.error("Error getting FCM token:", err);
    return null;
  }
}

export async function onForegroundMessage(
  callback: (payload: { title?: string; body?: string; data?: Record<string, string> }) => void
) {
  try {
    const messaging = await getFirebaseMessaging();
    const { onMessage } = await import("firebase/messaging");

    return onMessage(messaging, (payload) => {
      callback({
        title: payload.notification?.title || payload.data?.title,
        body: payload.notification?.body || payload.data?.body,
        data: payload.data,
      });
    });
  } catch (err) {
    console.error("Error setting up foreground messages:", err);
    return () => {};
  }
}
