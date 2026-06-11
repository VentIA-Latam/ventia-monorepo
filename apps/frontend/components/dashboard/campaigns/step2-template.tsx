"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useAccessToken } from "@/hooks/use-access-token";
import { updateCampaign } from "@/lib/services/campaigns-service";
import type { Campaign } from "@/lib/types/campaign";

interface WhatsAppTemplate {
  id?: string | number;
  name: string;
  language: string;
  status?: string;
  category?: string;
  components?: Array<{ type: string; text?: string; format?: string }>;
}

function isTemplate(x: unknown): x is WhatsAppTemplate {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.name === "string" && typeof o.language === "string";
}

interface Props {
  campaign: Campaign;
  templates: unknown[];
  onSaved: (updated: Campaign) => void;
  onBack: () => void;
}

export function Step2Template({ campaign, templates, onSaved, onBack }: Props) {
  const { toast } = useToast();
  const accessToken = useAccessToken();
  const [submitting, setSubmitting] = useState(false);

  const approvedTemplates = useMemo(
    () =>
      templates
        .filter(isTemplate)
        .filter((t) => !t.status || t.status.toLowerCase() === "approved"),
    [templates]
  );

  const [selected, setSelected] = useState<WhatsAppTemplate | null>(() => {
    if (!campaign.template_params?.name) return null;
    return (
      approvedTemplates.find(
        (t) =>
          t.name === campaign.template_params!.name &&
          t.language === campaign.template_params!.language
      ) ?? null
    );
  });

  const onSubmit = async () => {
    if (!selected || !accessToken) return;
    setSubmitting(true);
    try {
      const response = await updateCampaign(accessToken, campaign.id, {
        template_params: {
          name: selected.name,
          language: selected.language,
          variables: campaign.template_params?.variables ?? {},
        },
      });
      onSaved(response.data);
    } catch (e) {
      toast({
        title: "No se pudo guardar el template",
        description: e instanceof Error ? e.message : "Inténtalo de nuevo",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Elegí el template
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Solo se muestran templates aprobados por Meta en el inbox{" "}
          <strong className="text-foreground">{campaign.inbox.name}</strong>.
        </p>
      </header>

      {approvedTemplates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No hay templates aprobados en este inbox. Configurá uno en{" "}
          <a href="/dashboard/channels" className="text-volt underline">
            Configuración de canales
          </a>{" "}
          y esperá la aprobación de Meta.
        </div>
      ) : (
        <ul className="space-y-2">
          {approvedTemplates.map((t) => {
            const body = t.components?.find((c) => c.type === "BODY")?.text;
            const isSelected = selected?.name === t.name && selected?.language === t.language;
            return (
              <li key={`${t.name}-${t.language}`}>
                <button
                  type="button"
                  onClick={() => setSelected(t)}
                  className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${
                    isSelected ? "border-volt bg-volt/5" : "border-border hover:bg-muted"
                  }`}
                >
                  <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-foreground">
                        {t.name}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {t.language}
                      </span>
                      {t.category && (
                        <span className="text-xs text-muted-foreground">
                          · {t.category}
                        </span>
                      )}
                    </div>
                    {body && (
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                        {body}
                      </p>
                    )}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <footer className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          ← Atrás
        </Button>
        <Button onClick={onSubmit} disabled={!selected || submitting}>
          {submitting ? "Guardando..." : "Siguiente →"}
        </Button>
      </footer>
    </div>
  );
}
