"use client";

import { useState, useCallback } from "react";
import { Users, CreditCard, MessageSquare, Bot, Loader2 } from "lucide-react";
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

const CATEGORIES = [
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

const DEFAULT_FLAGS: NotificationFlags = {
  human_support: true,
  payment_review: true,
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
  const [flags, setFlags] = useState<NotificationFlags>(DEFAULT_FLAGS);
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
          setFlags(data.data.push_flags);
        }
        setFetched(true);
      }
    } catch (err) {
      console.error("Failed to fetch notification settings:", err);
    } finally {
      setLoading(false);
    }
  }, [fetched]);

  const handleOpenChange = useCallback(
    (isOpen: boolean) => {
      if (isOpen) fetchSettings();
      onOpenChange(isOpen);
    },
    [fetchSettings, onOpenChange]
  );

  const handleToggle = useCallback(
    async (key: keyof NotificationFlags, checked: boolean) => {
      const prev = { ...flags };
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
    [flags]
  );

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Notificaciones push</DialogTitle>
          <DialogDescription>
            Elige qué notificaciones push quieres recibir
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="divide-y divide-border">
            {CATEGORIES.map((cat) => (
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
                  checked={flags[cat.key]}
                  onCheckedChange={(checked) => handleToggle(cat.key, checked)}
                  className="data-[state=checked]:bg-aqua shrink-0"
                />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
