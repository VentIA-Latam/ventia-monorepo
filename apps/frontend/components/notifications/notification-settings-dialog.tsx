"use client";

import { useState, useCallback, useEffect } from "react";
import { Users, CreditCard, MessageSquare, Bot, Loader2, Mail, Bell } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";

interface NotificationFlags {
  human_support: boolean;
  payment_review: boolean;
  message_ai_off: boolean;
  message_ai_on: boolean;
}

const EMAIL_CATEGORIES = [
  {
    key: "human_support" as const,
    label: "Soporte humano",
    description: "Cuando un cliente necesita atención humana",
    icon: Users,
  },
  {
    key: "payment_review" as const,
    label: "Pago pendiente",
    description: "Cuando un cliente envía comprobante de pago",
    icon: CreditCard,
  },
] as const;

const PUSH_CATEGORIES = [
  {
    key: "message_ai_off" as const,
    label: "Mensajes (IA apagada)",
    description: "Mensajes en conversaciones sin agente IA",
    icon: MessageSquare,
  },
  {
    key: "message_ai_on" as const,
    label: "Mensajes (IA encendida)",
    description: "Mensajes en conversaciones con agente IA activo",
    icon: Bot,
  },
] as const;

const DEFAULT_EMAIL_FLAGS: NotificationFlags = {
  human_support: true,
  payment_review: true,
  message_ai_off: false,
  message_ai_on: false,
};

const DEFAULT_PUSH_FLAGS: NotificationFlags = {
  human_support: false,
  payment_review: false,
  message_ai_off: true,
  message_ai_on: false,
};

export function NotificationSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [emailFlags, setEmailFlags] = useState<NotificationFlags>(DEFAULT_EMAIL_FLAGS);
  const [pushFlags, setPushFlags] = useState<NotificationFlags>(DEFAULT_PUSH_FLAGS);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchSettings = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch("/api/messaging/notification-settings", { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data?.data?.push_flags) {
          setPushFlags(data.data.push_flags);
        }
        if (data?.data?.email_flags) {
          setEmailFlags(data.data.email_flags);
        }
        setFetched(true);
      }
    } catch (err) {
      console.error("Failed to fetch notification settings:", err);
    } finally {
      setLoading(false);
    }
  }, [fetched]);

  useEffect(() => {
    if (open) fetchSettings();
  }, [open, fetchSettings]);

  const handleToggle = useCallback(
    async (key: keyof NotificationFlags, checked: boolean, channel: "email" | "push") => {
      const setFlags = channel === "email" ? setEmailFlags : setPushFlags;
      const currentFlags = channel === "email" ? emailFlags : pushFlags;
      const prev = { ...currentFlags };
      setFlags((f) => ({ ...f, [key]: checked }));

      try {
        const res = await fetch("/api/messaging/notification-settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ [key]: checked }),
        });
        if (!res.ok) {
          setFlags(prev);
        }
      } catch {
        setFlags(prev);
      }
    },
    [emailFlags, pushFlags]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notificaciones</DialogTitle>
          <DialogDescription>
            Configura cómo quieres recibir las notificaciones
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Mail className="h-4 w-4 text-cielo" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Por email
                </h3>
              </div>
              <div className="divide-y divide-border">
                {EMAIL_CATEGORIES.map((cat) => (
                  <div
                    key={cat.key}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <cat.icon className="h-5 w-5 text-cielo shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{cat.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={emailFlags[cat.key]}
                      onCheckedChange={(checked) => handleToggle(cat.key, checked, "email")}
                      className="data-[state=checked]:bg-aqua shrink-0"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-3">
                <Bell className="h-4 w-4 text-cielo" />
                <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                  Push
                </h3>
              </div>
              <div className="divide-y divide-border">
                {PUSH_CATEGORIES.map((cat) => (
                  <div
                    key={cat.key}
                    className="flex items-center justify-between gap-4 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <cat.icon className="h-5 w-5 text-cielo shrink-0 mt-0.5" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium leading-tight">{cat.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{cat.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={pushFlags[cat.key]}
                      onCheckedChange={(checked) => handleToggle(cat.key, checked, "push")}
                      className="data-[state=checked]:bg-aqua shrink-0"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
