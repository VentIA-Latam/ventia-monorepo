"use client";

import { useEffect, useState } from "react";
import { AlertCircle, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAccessToken } from "@/hooks/use-access-token";
import { previewCampaign } from "@/lib/services/campaigns-service";
import type { Campaign, CampaignPreview } from "@/lib/types/campaign";

interface Props {
  campaign: Campaign;
  onContinue: () => void;
  onBack: () => void;
}

export function Step5Preview({ campaign, onContinue, onBack }: Props) {
  const accessToken = useAccessToken();
  const [preview, setPreview] = useState<CampaignPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!accessToken) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    previewCampaign(accessToken, campaign.id)
      .then((res) => setPreview(res.data))
      .catch((e) =>
        setError(e instanceof Error ? e.message : "Error al generar preview")
      )
      .finally(() => setLoading(false));
  }, [accessToken, campaign.id]);

  const allOmitted =
    preview &&
    preview.recipients_count > 0 &&
    preview.samples.length === 0;

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Vista previa
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Render con datos reales para 3 destinatarios sample.
        </p>
      </header>

      {loading && (
        <div className="rounded-lg border border-border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          Generando preview…
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--danger)]/30 bg-[var(--danger-bg)] p-3 text-sm text-[var(--danger)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {allOmitted && (
        <div className="flex items-start gap-2 rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-bg)] p-3 text-sm text-[var(--warning)]">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <div className="font-medium">Todos los destinatarios serían omitidos</div>
            <div className="mt-0.5 text-xs opacity-80">
              Volvé al paso 4 y revisá que el atributo elegido exista en tus contactos.
            </div>
          </div>
        </div>
      )}

      {preview && !loading && (
        <>
          <div className="text-sm text-muted-foreground">
            <strong className="text-foreground tabular-nums">
              {preview.recipients_count}
            </strong>{" "}
            destinatarios totales
            {preview.omitted_samples.length > 0 && (
              <>
                {" · "}
                <span className="text-[var(--warning)]">
                  {preview.omitted_samples.length}+ omitidos por falta de datos
                </span>
              </>
            )}
          </div>

          <div className="space-y-3">
            {preview.samples.map((sample) => (
              <div
                key={sample.recipient_id}
                className="rounded-lg border border-border bg-[color-mix(in_oklch,var(--success-bg)_60%,white)] p-4"
              >
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />
                  <span>{sample.contact_name ?? "Sin nombre"}</span>
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {sample.phone}
                  </span>
                </div>
                {sample.header_media && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={sample.header_media}
                    alt="Header"
                    className="mt-2 max-h-32 rounded"
                  />
                )}
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">
                  {sample.rendered_body ?? sample.error ?? "(sin contenido)"}
                </p>
              </div>
            ))}
          </div>

          {preview.omitted_samples.length > 0 && (
            <details className="rounded-lg border border-[var(--warning)]/30 bg-[var(--warning-bg)]/30 p-3">
              <summary className="cursor-pointer text-sm font-medium text-[var(--warning)]">
                Ver hasta {preview.omitted_samples.length} omitidos
              </summary>
              <ul className="mt-2 space-y-0.5 text-xs">
                {preview.omitted_samples.map((s, i) => (
                  <li key={i} className="font-mono tabular-nums text-muted-foreground">
                    {s.phone} — {s.reason}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </>
      )}

      <footer className="flex justify-between">
        <Button variant="outline" onClick={onBack}>
          ← Atrás
        </Button>
        <Button onClick={onContinue} disabled={loading || !!error || !!allOmitted}>
          Siguiente →
        </Button>
      </footer>
    </div>
  );
}
