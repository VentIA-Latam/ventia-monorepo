"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useAccessToken } from "@/hooks/use-access-token";
import {
  fetchCampaignRecipients,
  updateCampaign,
} from "@/lib/services/campaigns-service";
import {
  CONTACT_BUILT_IN_ATTRIBUTES,
  type Campaign,
  type CampaignVariableMapping,
} from "@/lib/types/campaign";

interface WhatsAppTemplate {
  name: string;
  language: string;
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

// Extrae los placeholders {{N}} del body del template, ordenados.
function extractPlaceholders(template?: WhatsAppTemplate): string[] {
  if (!template?.components) return [];
  const body = template.components.find((c) => c.type === "BODY")?.text ?? "";
  const found = new Set<string>();
  body.replace(/\{\{(\d+)\}\}/g, (_, idx) => {
    found.add(idx);
    return "";
  });
  return Array.from(found).sort((a, b) => Number(a) - Number(b));
}

function hasHeaderImage(template?: WhatsAppTemplate): boolean {
  return !!template?.components?.some(
    (c) => c.type === "HEADER" && c.format === "IMAGE"
  );
}

export function Step4Variables({ campaign, templates, onSaved, onBack }: Props) {
  const { toast } = useToast();
  const accessToken = useAccessToken();
  const [submitting, setSubmitting] = useState(false);
  const [csvColumns, setCsvColumns] = useState<string[]>([]);

  const template = useMemo(() => {
    if (!campaign.template_params?.name) return undefined;
    return templates
      .filter(isTemplate)
      .find(
        (t) =>
          t.name === campaign.template_params!.name &&
          t.language === campaign.template_params!.language
      );
  }, [campaign.template_params, templates]);

  const placeholders = useMemo(() => extractPlaceholders(template), [template]);
  const needsHeader = useMemo(() => hasHeaderImage(template), [template]);
  const isCsv = campaign.audience_type === "csv";

  const [variables, setVariables] = useState<Record<string, CampaignVariableMapping>>(
    () => campaign.template_params?.variables ?? {}
  );
  const [headerUrl, setHeaderUrl] = useState(campaign.header_media_url ?? "");

  // Para CSV: detectar columnas inspeccionando el primer recipient.
  useEffect(() => {
    if (!isCsv || !accessToken) return;
    fetchCampaignRecipients(accessToken, campaign.id, { page: 1, per_page: 1 })
      .then((res) => {
        const first = res.data[0];
        if (!first) return;
        // Vars del recipient son { columna: valor }, las columnas son las keys.
        // Hacemos otro fetch a la rama de recipients para inferir (TODO: backend podría
        // devolver columnas en /campaigns/:id pero por ahora inferimos).
        const cols = Object.keys((first as { vars?: Record<string, unknown> }).vars ?? {});
        setCsvColumns(cols);
      })
      .catch(() => {
        // sin info — el usuario tendrá fallback a free-text
      });
  }, [isCsv, accessToken, campaign.id]);

  const updateVar = (idx: string, mapping: CampaignVariableMapping) => {
    setVariables((prev) => ({ ...prev, [idx]: mapping }));
  };

  const allVarsAssigned = placeholders.every((idx) => {
    const v = variables[idx];
    if (!v) return false;
    if (v.source === "csv_column") return !!v.key;
    if (v.source === "contact_attribute") return !!v.path;
    return false;
  });

  const headerOk = !needsHeader || headerUrl.trim().length > 0;

  const onSubmit = async () => {
    if (!accessToken || !campaign.template_params) return;
    if (!allVarsAssigned || !headerOk) return;
    setSubmitting(true);
    try {
      const response = await updateCampaign(accessToken, campaign.id, {
        template_params: {
          ...campaign.template_params,
          variables,
        },
        header_media_url: needsHeader ? headerUrl.trim() : null,
      });
      onSaved(response.data);
    } catch (e) {
      toast({
        title: "No se pudieron guardar las variables",
        description: e instanceof Error ? e.message : "Intentá de nuevo",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (placeholders.length === 0 && !needsHeader) {
    return (
      <div className="space-y-6">
        <header>
          <h2 className="font-heading text-xl font-semibold text-foreground">
            Variables
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Este template no tiene variables ni header de imagen. Podés continuar.
          </p>
        </header>
        <footer className="flex justify-between">
          <Button variant="outline" onClick={onBack}>
            ← Atrás
          </Button>
          <Button onClick={onSubmit} disabled={submitting}>
            {submitting ? "Guardando..." : "Siguiente →"}
          </Button>
        </footer>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header>
        <h2 className="font-heading text-xl font-semibold text-foreground">
          Variables del template
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {isCsv
            ? "Mapeá cada variable a una columna del CSV."
            : "Mapeá cada variable a un atributo del Contact."}
        </p>
      </header>

      <div className="space-y-3">
        {placeholders.map((idx) => (
          <div key={idx} className="rounded-lg border border-border p-3">
            <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {`{{${idx}}}`}
            </Label>
            <div className="mt-1.5">
              {isCsv ? (
                <CsvColumnPicker
                  columns={csvColumns}
                  value={variables[idx]?.key ?? ""}
                  onChange={(key) =>
                    updateVar(idx, { source: "csv_column", key })
                  }
                />
              ) : (
                <AttributePicker
                  value={variables[idx]?.path ?? ""}
                  onChange={(path) =>
                    updateVar(idx, { source: "contact_attribute", path })
                  }
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {needsHeader && (
        <div className="rounded-lg border border-border p-3">
          <Label htmlFor="header-url" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            URL de la imagen del header
          </Label>
          <Input
            id="header-url"
            type="url"
            value={headerUrl}
            onChange={(e) => setHeaderUrl(e.target.value)}
            placeholder="https://..."
            className="mt-1.5"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            La imagen es fija para toda la campaña. HTTPS público.
          </p>
        </div>
      )}

      <footer className="flex justify-between">
        <Button variant="outline" onClick={onBack} disabled={submitting}>
          ← Atrás
        </Button>
        <Button onClick={onSubmit} disabled={!allVarsAssigned || !headerOk || submitting}>
          {submitting ? "Guardando..." : "Siguiente →"}
        </Button>
      </footer>
    </div>
  );
}

// ─── Pickers ────────────────────────────────────────────────────────────────

function CsvColumnPicker({
  columns,
  value,
  onChange,
}: {
  columns: string[];
  value: string;
  onChange: (key: string) => void;
}) {
  if (columns.length === 0) {
    return (
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nombre de la columna CSV"
      />
    );
  }
  return (
    <select
      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Elegir columna…</option>
      {columns.map((c) => (
        <option key={c} value={c}>
          {c}
        </option>
      ))}
    </select>
  );
}

function AttributePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (path: string) => void;
}) {
  const builtIn = CONTACT_BUILT_IN_ATTRIBUTES.map((a) => a.path);
  const isCustom = value.startsWith("custom_attributes.") || (!builtIn.includes(value) && value !== "");
  const [mode, setMode] = useState<"built-in" | "custom">(isCustom ? "custom" : "built-in");
  const [customKey, setCustomKey] = useState(
    isCustom ? value.replace(/^custom_attributes\./, "") : ""
  );

  return (
    <div className="space-y-2">
      <select
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
        value={mode === "custom" ? "__custom__" : value}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "__custom__") {
            setMode("custom");
            if (customKey) onChange(`custom_attributes.${customKey}`);
            else onChange("");
          } else {
            setMode("built-in");
            onChange(v);
          }
        }}
      >
        <option value="">Elegir atributo…</option>
        {CONTACT_BUILT_IN_ATTRIBUTES.map((a) => (
          <option key={a.path} value={a.path}>
            {a.label}
          </option>
        ))}
        <option value="__custom__">Atributo personalizado…</option>
      </select>

      {mode === "custom" && (
        <Input
          value={customKey}
          onChange={(e) => {
            const k = e.target.value;
            setCustomKey(k);
            onChange(k ? `custom_attributes.${k}` : "");
          }}
          placeholder="ej. order_id, discount_code"
        />
      )}
    </div>
  );
}
