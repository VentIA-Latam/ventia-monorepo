"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccessToken } from "@/hooks/use-access-token";
import { updateCampaign } from "@/lib/services/campaigns-service";
import type { Campaign } from "@/lib/types/campaign";

const schema = z.object({
  title: z.string().min(1, "Requerido").max(120, "Máximo 120 caracteres"),
  inbox_id: z.number().int().positive(),
});

type FormValues = z.infer<typeof schema>;

interface InboxOption {
  id: number;
  name: string;
  channel_type?: string;
}

function isInboxOption(x: unknown): x is InboxOption {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "number" && typeof o.name === "string";
}

interface Props {
  campaign: Campaign;
  inboxes: unknown[];
  onSaved: (updated: Campaign) => void;
}

export function Step1Basics({ campaign, inboxes, onSaved }: Props) {
  const { toast } = useToast();
  const accessToken = useAccessToken();
  const [submitting, setSubmitting] = useState(false);

  const whatsappInboxes = inboxes
    .filter(isInboxOption)
    .filter((i) => !i.channel_type || i.channel_type === "Channel::Whatsapp");

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
    setValue,
    watch,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: {
      title: campaign.title,
      inbox_id: campaign.inbox.id,
    },
  });

  const selectedInbox = watch("inbox_id");

  const onSubmit = async (values: FormValues) => {
    if (!accessToken) return;
    setSubmitting(true);
    try {
      // El backend requiere inbox_id en el create pero el endpoint PATCH solo permite title.
      // Para v1: si el usuario cambió el inbox, mostrar warning porque vars y template
      // dependen del inbox. Por ahora solo permitimos cambiar title.
      const inboxChanged = values.inbox_id !== campaign.inbox.id;
      if (inboxChanged) {
        toast({
          title: "Cambio de inbox no soportado",
          description:
            "Para cambiar el inbox, cancela esta campaña y crea una nueva. Los templates dependen del inbox.",
          variant: "destructive",
        });
        setSubmitting(false);
        return;
      }

      const response = await updateCampaign(accessToken, campaign.id, {
        title: values.title,
      });
      onSaved(response.data);
    } catch (e) {
      toast({
        title: "No se pudo guardar",
        description: e instanceof Error ? e.message : "Inténtalo de nuevo",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <header>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Datos básicos
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Nombre interno de la campaña y desde qué inbox de WhatsApp se enviará.
        </p>
      </header>

      <div className="space-y-2">
        <Label htmlFor="title">Nombre de la campaña</Label>
        <Input
          id="title"
          data-testid="step1-title-input"
          {...register("title")}
          placeholder="Ej. Recordatorio entregas Mayo"
          autoFocus
        />
        {errors.title && (
          <p className="text-xs text-[var(--danger)]">{errors.title.message}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label>Inbox de envío</Label>
        <div className="space-y-1.5">
          {whatsappInboxes.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No hay inboxes de WhatsApp disponibles.
            </p>
          ) : (
            whatsappInboxes.map((inbox) => (
              <button
                type="button"
                key={inbox.id}
                onClick={() => setValue("inbox_id", inbox.id, { shouldValidate: true })}
                className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition ${
                  selectedInbox === inbox.id
                    ? "border-volt bg-volt/5"
                    : "border-border hover:bg-muted"
                }`}
              >
                <Inbox className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">
                  {inbox.name}
                </span>
              </button>
            ))
          )}
        </div>
      </div>

      <footer className="flex justify-end">
        <Button
          type="submit"
          data-testid="wizard-next-button"
          disabled={!isValid || submitting}
        >
          {submitting ? "Guardando..." : "Siguiente →"}
        </Button>
      </footer>
    </form>
  );
}
