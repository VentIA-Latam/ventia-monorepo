"use client";

import { useEffect, useState, useCallback } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

export default function NotificationSetup() {
  const { toast } = useToast();
  const [permissionState] = useState<NotificationPermission | "unsupported">(() =>
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "unsupported"
  );
  const [showBanner, setShowBanner] = useState(false);
  const [registered, setRegistered] = useState(false);

  const registerToken = useCallback(async () => {
    try {
      const { requestNotificationPermission } = await import("@/lib/firebase-client");
      const token = await requestNotificationPermission();
      if (!token) return;

      await fetch("/api/messaging/push-tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token, platform: "web" }),
      });

      setRegistered(true);
      setShowBanner(false);
    } catch (err) {
      console.error("Failed to register push token:", err);
    }
  }, []);

  const setupForegroundListener = useCallback(async () => {
    try {
      const { onForegroundMessage } = await import("@/lib/firebase-client");
      await onForegroundMessage((payload) => {
        toast({
          title: payload.title || "VentIA",
          description: payload.body,
        });
      });
    } catch (err) {
      console.error("Failed to setup foreground listener:", err);
    }
  }, [toast]);

  useEffect(() => {
    if (permissionState === "unsupported") return;

    if (permissionState === "granted" && !registered) {
      registerToken();
      setupForegroundListener();
    } else if (permissionState === "default") {
      setShowBanner(true);
    }
  }, [permissionState, registered, registerToken, setupForegroundListener]);

  const handleEnable = async () => {
    await registerToken();
    if (registered) {
      setupForegroundListener();
    }
  };

  if (!showBanner || permissionState === "unsupported" || permissionState === "denied") {
    return null;
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-aqua/30 bg-aqua/5 px-4 py-3">
      <Bell className="h-5 w-5 text-aqua shrink-0" />
      <p className="text-sm flex-1">
        Activa las notificaciones para recibir alertas de nuevos mensajes.
      </p>
      <Button size="sm" onClick={handleEnable} className="bg-aqua hover:bg-aqua/90 text-noche">
        Activar
      </Button>
      <button
        onClick={() => setShowBanner(false)}
        className="text-muted-foreground hover:text-foreground"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
