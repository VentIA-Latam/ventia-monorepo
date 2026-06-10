"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Calendar, Check, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccessToken } from "@/hooks/use-access-token";
import { triggerCampaign } from "@/lib/services/campaigns-service";
import type { Campaign } from "@/lib/types/campaign";

interface Props {
  campaign: Campaign;
  onTriggered: (mode: "now" | "scheduled") => void;
  onBack: () => void;
}

type Mode = "now" | "scheduled";

export function Step6Schedule({ campaign, onTriggered, onBack }: Props) {
  const { toast } = useToast();
  const accessToken = useAccessToken();
  const [mode, setMode] = useState<Mode>("now");
  const [datetime, setDatetime] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  // Min datetime: ahora + 1 min en formato local datetime-local input.
  // useMemo evita recalcular durante render (lint: no impure calls during render).
  const minDatetime = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    const d = new Date(Date.now() + 60_000);
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, []);

  const canSubmit =
    mode === "now" || (mode === "scheduled" && datetime.length > 0);

  const onSubmit = async () => {
    if (!accessToken || !canSubmit) return;
    setSubmitting(true);
    try {
      const scheduledIso =
        mode === "scheduled" ? new Date(datetime).toISOString() : undefined;
      await triggerCampaign(accessToken, campaign.id, scheduledIso);
      onTriggered(mode);
    } catch (e) {
      toast({
        title: "No se pudo disparar",
        description: e instanceof Error ? e.message : "Inténtalo de nuevo",
        variant: "destructive",
      });
      setSubmitting(false);
    }
  };

  const willSend = campaign.recipients_count - (campaign.stats?.omitted ?? 0);

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          ¿Cuándo enviamos?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Podés disparar la campaña inmediatamente o programar una fecha.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <ModeButton
          icon={<Zap className="h-5 w-5" />}
          label="Enviar ahora"
          desc="Se encola y empieza en segundos"
          active={mode === "now"}
          onClick={() => setMode("now")}
        />
        <ModeButton
          icon={<Calendar className="h-5 w-5" />}
          label="Programar"
          desc="Elegí fecha y hora"
          active={mode === "scheduled"}
          onClick={() => setMode("scheduled")}
        />
      </div>

      {mode === "scheduled" && (
        <div className="space-y-2">
          <Label htmlFor="scheduled-at">Fecha y hora</Label>
          <Input
            id="scheduled-at"
            type="datetime-local"
            min={minDatetime}
            value={datetime}
            onChange={(e) => setDatetime(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            Mínimo 1 minuto a partir de ahora. Hora local.
          </p>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-bg)] p-3 text-sm">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--warning)]" />
        <div className="text-[var(--warning)]">
          <div className="font-medium">Confirmación</div>
          <div className="mt-0.5 text-xs opacity-80">
            Vas a enviar{" "}
            <strong className="tabular-nums">
              {campaign.template_params?.name ?? "(template)"}
            </strong>{" "}
            a <strong className="tabular-nums">{willSend} contactos</strong>
            {campaign.stats?.omitted ? (
              <>
                {" "}
                ({campaign.stats.omitted} omitidos por falta de datos)
              </>
            ) : null}
            . Costo estimado: {willSend} mensajes marketing.
          </div>
        </div>
      </div>

      <footer className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          ← Atrás
        </Button>
        <Button onClick={onSubmit} disabled={!canSubmit || submitting}>
          {!submitting && <Check className="h-4 w-4" />}
          {submitting
            ? "Disparando..."
            : mode === "now"
              ? "Enviar ahora"
              : "Programar"}
        </Button>
      </footer>
    </div>
  );
}

function ModeButton({
  icon,
  label,
  desc,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-start gap-3 rounded-lg border p-4 text-left transition ${
        active ? "border-volt bg-volt/5" : "border-border hover:bg-muted"
      }`}
    >
      <div className={active ? "text-volt" : "text-muted-foreground"}>
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold text-foreground">{label}</div>
        <div className="text-xs text-muted-foreground">{desc}</div>
      </div>
    </button>
  );
}
