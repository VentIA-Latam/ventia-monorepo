"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Badge } from "@/components/ui/badge";
import { Search, RefreshCw, FileText, ArrowLeft, AlertCircle } from "lucide-react";
import { getTemplates, syncTemplates, sendTemplateMessage } from "@/lib/api-client/messaging";
import { TemplateParameterForm } from "./template-parameter-form";
import type { WhatsAppTemplate, SendTemplatePayload } from "@/lib/types/messaging";

interface TemplatePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  inboxId: number | null;
  conversationId: number;
  onSent: () => void;
}

function getTemplateBody(template: WhatsAppTemplate): string {
  const body = template.components.find((c) => c.type === "BODY");
  return body?.text || "";
}

function getTemplateHeader(template: WhatsAppTemplate): string | null {
  const header = template.components.find((c) => c.type === "HEADER");
  if (!header) return null;
  if (header.format && header.format !== "TEXT") return `[${header.format}]`;
  return header.text || null;
}

const CATEGORY_LABELS: Record<string, string> = {
  MARKETING: "Marketing",
  UTILITY: "Utilidad",
  TRANSACTIONAL: "Transaccional",
};

export function TemplatePicker({
  open,
  onOpenChange,
  inboxId,
  conversationId,
  onSent,
}: TemplatePickerProps) {
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<WhatsAppTemplate | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!inboxId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await getTemplates(inboxId);
      setTemplates(result.data ?? []);
    } catch (err) {
      console.error("Error fetching templates:", err);
      setError("No se pudieron cargar las plantillas.");
    } finally {
      setLoading(false);
    }
  }, [inboxId]);

  useEffect(() => {
    if (open && inboxId) {
      fetchTemplates();
      setSelectedTemplate(null);
      setSearch("");
      setSendError(null);
    }
  }, [open, inboxId, fetchTemplates]);

  const handleSync = useCallback(async () => {
    if (!inboxId) return;
    setSyncing(true);
    setError(null);
    try {
      await syncTemplates(inboxId);
      await fetchTemplates();
    } catch (err) {
      console.error("Error syncing templates:", err);
      setError("Error al sincronizar plantillas con Meta.");
    } finally {
      setSyncing(false);
    }
  }, [inboxId, fetchTemplates]);

  const handleSendTemplate = useCallback(
    async (payload: SendTemplatePayload) => {
      setSending(true);
      setSendError(null);
      try {
        await sendTemplateMessage(conversationId, payload);
        onSent();
        onOpenChange(false);
      } catch (err) {
        console.error("Error sending template:", err);
        setSendError("Error al enviar la plantilla. Intenta de nuevo.");
      } finally {
        setSending(false);
      }
    },
    [conversationId, onSent, onOpenChange]
  );

  const filteredTemplates = useMemo(() => {
    if (!search) return templates;
    const q = search.toLowerCase();
    return templates.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        getTemplateBody(t).toLowerCase().includes(q)
    );
  }, [templates, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center gap-2">
            {selectedTemplate && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0"
                onClick={() => { setSelectedTemplate(null); setSendError(null); }}
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <DialogTitle className="text-base">
              {selectedTemplate ? selectedTemplate.name : "Plantillas de WhatsApp"}
            </DialogTitle>
          </div>
        </DialogHeader>

        {selectedTemplate ? (
          <>
            {sendError && (
              <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{sendError}</span>
              </div>
            )}
            <TemplateParameterForm
              template={selectedTemplate}
              onSend={handleSendTemplate}
              sending={sending}
            />
          </>
        ) : (
          <>
            {/* Search + sync */}
            <div className="px-4 pb-2 flex gap-2 shrink-0">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar plantilla..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
                onClick={handleSync}
                disabled={syncing}
              >
                <RefreshCw className={`h-4 w-4 ${syncing ? "animate-spin" : ""}`} />
              </Button>
            </div>

            {/* Error message */}
            {error && (
              <div className="mx-4 mb-2 flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Template list */}
            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="rounded-lg border p-3 space-y-2">
                      <Skeleton className="h-4 w-40" />
                      <Skeleton className="h-3 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : filteredTemplates.length === 0 ? (
                <EmptyState
                  icon={<FileText className="h-6 w-6" />}
                  title="Sin plantillas"
                  description={
                    search
                      ? "No hay plantillas que coincidan con la búsqueda."
                      : "No hay plantillas aprobadas disponibles. Usa el botón de sincronizar para actualizar."
                  }
                />
              ) : (
                <div className="space-y-2">
                  {filteredTemplates.map((template) => {
                    const header = getTemplateHeader(template);
                    return (
                      <button
                        key={`${template.name}-${template.language}`}
                        className="w-full text-left rounded-lg border border-border/60 p-3 hover:bg-muted/40 transition-colors cursor-pointer"
                        onClick={() => setSelectedTemplate(template)}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-sm font-medium truncate">{template.name}</p>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 shrink-0">
                            {template.language}
                          </Badge>
                          {template.category && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                              {CATEGORY_LABELS[template.category] || template.category}
                            </Badge>
                          )}
                        </div>
                        {header && (
                          <p className="text-xs text-muted-foreground mb-0.5 italic">
                            {header}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground line-clamp-2">
                          {getTemplateBody(template)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
