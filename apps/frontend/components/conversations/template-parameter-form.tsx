"use client";

import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Send, Loader2 } from "lucide-react";
import type {
  WhatsAppTemplate,
  WhatsAppTemplateComponent,
  SendTemplatePayload,
} from "@/lib/types/messaging";

interface TemplateParameterFormProps {
  template: WhatsAppTemplate;
  onSend: (payload: SendTemplatePayload) => void;
  sending?: boolean;
}

interface TemplateVariables {
  body: Record<string, string>;
  header: Record<string, string>;
  buttons: Record<number, string>;
}

function extractBodyVariables(text: string): string[] {
  const matches = text.match(/\{\{([^}]+)\}\}/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/\{\{|\}\}/g, "").trim());
}

function findComponent(
  template: WhatsAppTemplate,
  type: string
): WhatsAppTemplateComponent | undefined {
  return template.components.find((c) => c.type === type);
}

function hasMediaHeader(template: WhatsAppTemplate): boolean {
  const header = findComponent(template, "HEADER");
  return !!header?.format && ["IMAGE", "VIDEO", "DOCUMENT"].includes(header.format);
}

function renderPreview(bodyText: string, variables: Record<string, string>): string {
  let result = bodyText;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(`{{${key}}}`, value || `{{${key}}}`);
  }
  return result;
}

export function TemplateParameterForm({
  template,
  onSend,
  sending,
}: TemplateParameterFormProps) {
  const bodyComponent = findComponent(template, "BODY");
  const headerComponent = findComponent(template, "HEADER");
  const footerComponent = findComponent(template, "FOOTER");
  const buttonsComponent = findComponent(template, "BUTTONS");

  const bodyVars = useMemo(
    () => extractBodyVariables(bodyComponent?.text || ""),
    [bodyComponent?.text]
  );

  const headerTextVars = useMemo(
    () =>
      headerComponent?.format === "TEXT" || (!headerComponent?.format && headerComponent?.text)
        ? extractBodyVariables(headerComponent?.text || "")
        : [],
    [headerComponent?.format, headerComponent?.text]
  );

  const urlButtons = useMemo(() => {
    if (!buttonsComponent?.buttons) return [];
    return buttonsComponent.buttons
      .map((b, i) => ({ ...b, index: i }))
      .filter((b) => b.type === "URL" && b.url?.includes("{{"));
  }, [buttonsComponent?.buttons]);

  const copyCodeButtons = useMemo(() => {
    if (!buttonsComponent?.buttons) return [];
    return buttonsComponent.buttons
      .map((b, i) => ({ ...b, index: i }))
      .filter((b) => b.type === "COPY_CODE");
  }, [buttonsComponent?.buttons]);

  const [variables, setVariables] = useState<TemplateVariables>(() => {
    const body: Record<string, string> = {};
    for (const v of bodyVars) body[v] = "";

    const header: Record<string, string> = {};
    if (hasMediaHeader(template)) {
      header.media_url = "";
      header.media_type = (headerComponent?.format || "IMAGE").toLowerCase();
      if (headerComponent?.format === "DOCUMENT") {
        header.media_name = "";
      }
    }
    for (const v of headerTextVars) header[v] = "";

    const buttons: Record<number, string> = {};
    for (const b of urlButtons) buttons[b.index] = "";
    for (const b of copyCodeButtons) buttons[b.index] = "";

    return { body, header, buttons };
  });

  const updateBodyVar = useCallback((key: string, value: string) => {
    setVariables((prev) => ({
      ...prev,
      body: { ...prev.body, [key]: value },
    }));
  }, []);

  const updateHeaderVar = useCallback((key: string, value: string) => {
    setVariables((prev) => ({
      ...prev,
      header: { ...prev.header, [key]: value },
    }));
  }, []);

  const updateButtonVar = useCallback((index: number, value: string) => {
    setVariables((prev) => ({
      ...prev,
      buttons: { ...prev.buttons, [index]: value },
    }));
  }, []);

  const headerPreviewText = useMemo(
    () =>
      headerTextVars.length > 0
        ? renderPreview(headerComponent?.text || "", variables.header)
        : headerComponent?.text || null,
    [headerComponent?.text, headerTextVars.length, variables.header]
  );

  const previewText = useMemo(
    () => renderPreview(bodyComponent?.text || "", variables.body),
    [bodyComponent?.text, variables.body]
  );

  const isValid = useMemo(() => {
    for (const v of bodyVars) {
      if (!variables.body[v]?.trim()) return false;
    }
    for (const v of headerTextVars) {
      if (!variables.header[v]?.trim()) return false;
    }
    if (hasMediaHeader(template) && !variables.header.media_url?.trim()) return false;
    return true;
  }, [bodyVars, headerTextVars, variables, template]);

  const handleSend = useCallback(() => {
    const processedParams: Record<string, unknown> = {};

    if (Object.keys(variables.body).length > 0) {
      processedParams.body = variables.body;
    }
    if (Object.keys(variables.header).length > 0) {
      processedParams.header = variables.header;
    }
    if (Object.keys(variables.buttons).length > 0) {
      const buttonsArr: (Record<string, string> | null)[] = [];
      const allButtons = buttonsComponent?.buttons || [];
      for (let i = 0; i < allButtons.length; i++) {
        const btn = allButtons[i];
        if (variables.buttons[i] !== undefined) {
          buttonsArr[i] = {
            type: btn.type === "COPY_CODE" ? "copy_code" : "url",
            parameter: variables.buttons[i],
          };
        } else {
          buttonsArr[i] = null;
        }
      }
      processedParams.buttons = buttonsArr;
    }

    const payload: SendTemplatePayload = {
      content: previewText,
      template_params: {
        name: template.name,
        namespace: template.namespace,
        language: template.language,
        processed_params: processedParams,
      },
    };

    onSend(payload);
  }, [variables, previewText, template, onSend, buttonsComponent?.buttons]);

  const needsInput =
    bodyVars.length > 0 ||
    headerTextVars.length > 0 ||
    hasMediaHeader(template) ||
    urlButtons.length > 0 ||
    copyCodeButtons.length > 0;

  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      {/* Preview */}
      <div className="px-4 pb-3 shrink-0">
        <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
          {headerPreviewText && (
            <p className="font-semibold text-xs">{headerPreviewText}</p>
          )}
          {headerComponent?.format && headerComponent.format !== "TEXT" && (
            <p className="text-xs text-muted-foreground italic">[{headerComponent.format}]</p>
          )}
          <p className="whitespace-pre-wrap">{previewText}</p>
          {footerComponent?.text && (
            <p className="text-xs text-muted-foreground mt-1">{footerComponent.text}</p>
          )}
          {buttonsComponent?.buttons && buttonsComponent.buttons.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-border/30">
              {buttonsComponent.buttons.map((btn, i) => (
                <span
                  key={i}
                  className="text-xs text-primary bg-primary/10 px-2 py-0.5 rounded"
                >
                  {btn.text}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Variable inputs */}
      {needsInput && (
        <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-3">
          {/* Header media */}
          {hasMediaHeader(template) && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">
                URL de {headerComponent?.format?.toLowerCase() || "media"}
              </Label>
              <Input
                placeholder={`https://ejemplo.com/${(headerComponent?.format || "image").toLowerCase()}.jpg`}
                value={variables.header.media_url || ""}
                onChange={(e) => updateHeaderVar("media_url", e.target.value)}
                className="h-9 text-sm"
              />
              {headerComponent?.format === "DOCUMENT" && (
                <>
                  <Label className="text-xs font-medium">Nombre del archivo</Label>
                  <Input
                    placeholder="documento.pdf"
                    value={variables.header.media_name || ""}
                    onChange={(e) => updateHeaderVar("media_name", e.target.value)}
                    className="h-9 text-sm"
                  />
                </>
              )}
            </div>
          )}

          {/* Header text variables */}
          {headerTextVars.map((varName) => (
            <div key={`header-${varName}`} className="space-y-1.5">
              <Label className="text-xs font-medium">Encabezado {`{{${varName}}}`}</Label>
              <Input
                placeholder={`Valor para encabezado {{${varName}}}`}
                value={variables.header[varName] || ""}
                onChange={(e) => updateHeaderVar(varName, e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          ))}

          {/* Body variables */}
          {bodyVars.map((varName) => (
            <div key={varName} className="space-y-1.5">
              <Label className="text-xs font-medium">{`{{${varName}}}`}</Label>
              <Input
                placeholder={`Valor para {{${varName}}}`}
                value={variables.body[varName] || ""}
                onChange={(e) => updateBodyVar(varName, e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          ))}

          {/* URL button variables */}
          {urlButtons.map((btn) => (
            <div key={`url-${btn.index}`} className="space-y-1.5">
              <Label className="text-xs font-medium">
                Botón &quot;{btn.text}&quot; - variable URL
              </Label>
              <Input
                placeholder="Valor del parámetro URL"
                value={variables.buttons[btn.index] || ""}
                onChange={(e) => updateButtonVar(btn.index, e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          ))}

          {/* Copy code button variables */}
          {copyCodeButtons.map((btn) => (
            <div key={`code-${btn.index}`} className="space-y-1.5">
              <Label className="text-xs font-medium">
                Botón &quot;{btn.text}&quot; - código
              </Label>
              <Input
                placeholder="Código (máx 15 caracteres)"
                maxLength={15}
                value={variables.buttons[btn.index] || ""}
                onChange={(e) => updateButtonVar(btn.index, e.target.value)}
                className="h-9 text-sm"
              />
            </div>
          ))}
        </div>
      )}

      {/* Send button */}
      <div className="px-4 py-3 border-t shrink-0">
        <Button
          className="w-full"
          disabled={!isValid || sending}
          onClick={handleSend}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          Enviar plantilla
        </Button>
      </div>
    </div>
  );
}
