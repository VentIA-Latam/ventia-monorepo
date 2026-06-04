"use client";

import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { FileSpreadsheet, Tag, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useAccessToken } from "@/hooks/use-access-token";
import {
  fetchCampaign,
  setLabelsAudience,
  uploadCampaignCsv,
} from "@/lib/services/campaigns-service";
import type {
  Campaign,
  CampaignCsvUploadResult,
} from "@/lib/types/campaign";

interface LabelOption {
  id: number;
  title: string;
}

function isLabel(x: unknown): x is LabelOption {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === "number" && typeof o.title === "string";
}

interface Props {
  campaign: Campaign;
  labels: unknown[];
  onSaved: (updated: Campaign) => void;
  onBack: () => void;
}

type Mode = "csv" | "labels";

export function Step3Audience({ campaign, labels, onSaved, onBack }: Props) {
  const { toast } = useToast();
  const accessToken = useAccessToken();
  const [mode, setMode] = useState<Mode>(
    campaign.audience_type === "csv" ? "csv" : "labels"
  );
  const [submitting, setSubmitting] = useState(false);

  const onNext = async () => {
    if (!accessToken) return;
    if (campaign.recipients_count === 0) {
      toast({
        title: "Sin destinatarios",
        description: "Cargá un CSV o seleccioná etiquetas con al menos 1 contacto.",
        variant: "destructive",
      });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetchCampaign(accessToken, campaign.id);
      onSaved(response.data);
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Intentá de nuevo",
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
          ¿De dónde sale la audiencia?
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Subí un CSV con teléfonos y datos, o seleccioná etiquetas existentes.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <ModeButton
          icon={<FileSpreadsheet className="h-5 w-5" />}
          label="CSV"
          desc="Subir archivo"
          active={mode === "csv"}
          onClick={() => setMode("csv")}
        />
        <ModeButton
          icon={<Tag className="h-5 w-5" />}
          label="Etiquetas"
          desc="Contactos por label"
          active={mode === "labels"}
          onClick={() => setMode("labels")}
        />
      </div>

      {mode === "csv" ? (
        <CsvUploader
          campaignId={campaign.id}
          accessToken={accessToken}
          recipientsCount={campaign.recipients_count}
        />
      ) : (
        <LabelsPicker
          campaignId={campaign.id}
          accessToken={accessToken}
          labels={labels.filter(isLabel)}
        />
      )}

      <footer className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          ← Atrás
        </Button>
        <Button
          onClick={onNext}
          disabled={submitting || campaign.recipients_count === 0}
        >
          {submitting ? "Cargando..." : "Siguiente →"}
        </Button>
      </footer>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

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
      className={`flex items-center gap-3 rounded-lg border p-4 text-left transition ${
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

function CsvUploader({
  campaignId,
  accessToken,
  recipientsCount,
}: {
  campaignId: number;
  accessToken: string | null;
  recipientsCount: number;
}) {
  const { toast } = useToast();
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<CampaignCsvUploadResult | null>(null);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      "text/csv": [".csv"],
      "application/vnd.ms-excel": [".csv"],
    },
    maxFiles: 1,
    onDrop: async (accepted) => {
      const file = accepted[0];
      if (!file || !accessToken) return;
      setUploading(true);
      try {
        const response = await uploadCampaignCsv(accessToken, campaignId, file);
        setResult(response.data);
        toast({
          title: "CSV procesado",
          description: `${response.data.recipients_count} destinatarios cargados.`,
        });
      } catch (e) {
        toast({
          title: "Error al subir CSV",
          description: e instanceof Error ? e.message : "Intentá de nuevo",
          variant: "destructive",
        });
      } finally {
        setUploading(false);
      }
    },
  });

  return (
    <div className="space-y-3">
      <div
        {...getRootProps()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition ${
          isDragActive ? "border-volt bg-volt/5" : "border-border bg-muted/30"
        }`}
      >
        <input {...getInputProps()} />
        <Upload className="h-6 w-6 text-muted-foreground" />
        <div className="text-sm font-medium text-foreground">
          {uploading
            ? "Subiendo..."
            : isDragActive
              ? "Soltá el archivo aquí"
              : "Arrastrá tu CSV o hacé click para seleccionar"}
        </div>
        <div className="text-xs text-muted-foreground">
          Máximo 5MB. Requiere columna <code>phone</code> o <code>telefono</code>.
        </div>
      </div>

      {result && (
        <div className="rounded-lg border border-border p-3">
          <div className="flex items-baseline justify-between">
            <strong className="text-sm font-semibold text-foreground">
              {result.recipients_count} destinatarios válidos
            </strong>
            {result.skipped_rows.length > 0 && (
              <span className="text-xs text-[var(--warning)]">
                {result.skipped_rows.length} omitidos
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            Columnas: {result.columns.join(", ") || "ninguna"}
          </div>
          {result.skipped_rows.length > 0 && (
            <details className="mt-2 text-xs">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                Ver filas omitidas
              </summary>
              <ul className="mt-1 space-y-0.5 text-muted-foreground">
                {result.skipped_rows.slice(0, 10).map((r, i) => (
                  <li key={i}>
                    Fila {r.row}: {r.phone ?? "—"} — {r.reason}
                  </li>
                ))}
                {result.skipped_rows.length > 10 && (
                  <li>… +{result.skipped_rows.length - 10} más</li>
                )}
              </ul>
            </details>
          )}
        </div>
      )}

      {!result && recipientsCount > 0 && (
        <div className="text-xs text-muted-foreground">
          Hay {recipientsCount} destinatarios cargados desde un upload previo. Re-subí
          el CSV para reemplazarlos.
        </div>
      )}
    </div>
  );
}

function LabelsPicker({
  campaignId,
  accessToken,
  labels,
}: {
  campaignId: number;
  accessToken: string | null;
  labels: LabelOption[];
}) {
  const { toast } = useToast();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [count, setCount] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const onApply = async () => {
    if (selectedIds.length === 0 || !accessToken) return;
    setSubmitting(true);
    try {
      const response = await setLabelsAudience(accessToken, campaignId, selectedIds);
      setCount(response.data.recipients_count);
      toast({
        title: "Audiencia actualizada",
        description: `${response.data.recipients_count} contactos coinciden.`,
      });
    } catch (e) {
      toast({
        title: "Error",
        description: e instanceof Error ? e.message : "Intentá de nuevo",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {labels.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          No hay etiquetas configuradas en tu cuenta.
        </div>
      ) : (
        <>
          <ul className="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
            {labels.map((label) => (
              <li key={label.id}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted">
                  <Checkbox
                    checked={selectedIds.includes(label.id)}
                    onCheckedChange={() => toggle(label.id)}
                  />
                  <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-sm text-foreground">{label.title}</span>
                </label>
              </li>
            ))}
          </ul>

          <div className="flex items-center justify-between">
            <Button
              size="sm"
              variant="outline"
              onClick={onApply}
              disabled={selectedIds.length === 0 || submitting}
            >
              {submitting ? "Calculando..." : "Aplicar etiquetas"}
            </Button>
            {count !== null && (
              <span className="text-sm font-medium text-foreground tabular-nums">
                {count} destinatarios
              </span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
