"use client";

import { useState, useMemo, useCallback } from "react";
import { Clock, Save, Info, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { updateReminders } from "@/lib/api-client/reminders";
import type {
  ReminderMessagesResponse,
  ReminderMessageUpdate,
} from "@/lib/types/reminder";

const MAX_CHARS = 300;

const WINDOW_LABELS: Record<string, string> = {
  primer_recordatorio: "Primer recordatorio (3-4h)",
  ultimo_recordatorio: "Ultimo recordatorio (22-23h)",
};

const WINDOW_SHORT_LABELS: Record<string, string> = {
  primer_recordatorio: "Primer recordatorio (2-3h)",
  ultimo_recordatorio: "Ultimo recordatorio (22-23h)",
};

const TEMP_COLORS: Record<string, string> = {
  frio: "bg-blue-100 text-blue-700 border-blue-200",
  tibio: "bg-amber-100 text-amber-700 border-amber-200",
  caliente: "bg-red-100 text-red-700 border-red-200",
};

const TEMP_DISPLAY: Record<string, string> = {
  frio: "Frio",
  tibio: "Tibio",
  caliente: "Caliente",
};

function getWindowLabel(label: string): string {
  return WINDOW_LABELS[label] || label.replace(/_/g, " ");
}

function getWindowShortLabel(label: string): string {
  return WINDOW_SHORT_LABELS[label] || label.replace(/_/g, " ");
}

function getTempColor(temperature: string): string {
  return TEMP_COLORS[temperature] || "bg-gray-100 text-gray-700 border-gray-200";
}

function getTempDisplay(temperature: string): string {
  return TEMP_DISPLAY[temperature] || temperature.charAt(0).toUpperCase() + temperature.slice(1);
}

function getCurrentTime(): string {
  const now = new Date();
  return now.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
}

interface Props {
  initialData: ReminderMessagesResponse;
}

export function RemindersClient({ initialData }: Props) {
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);

  // Build initial text map from data
  const initialTexts = useMemo(() => {
    const map: Record<string, string> = {};
    for (const win of initialData.windows) {
      for (const msg of win.messages) {
        map[msg.node_id] = msg.text;
      }
    }
    return map;
  }, [initialData]);

  const [editedTexts, setEditedTexts] = useState<Record<string, string>>(initialTexts);

  // Derive unique temperatures across all windows (for tabs)
  const temperatures = useMemo(() => {
    const seen = new Set<string>();
    const result: string[] = [];
    for (const win of initialData.windows) {
      for (const msg of win.messages) {
        if (!seen.has(msg.temperature)) {
          seen.add(msg.temperature);
          result.push(msg.temperature);
        }
      }
    }
    return result;
  }, [initialData]);

  // Find the active message for preview
  const activePreview = useMemo(() => {
    if (!activeNodeId) return null;
    for (const win of initialData.windows) {
      for (const msg of win.messages) {
        if (msg.node_id === activeNodeId) {
          return {
            text: editedTexts[msg.node_id] ?? msg.text,
            windowLabel: getWindowShortLabel(win.window_label),
          };
        }
      }
    }
    return null;
  }, [activeNodeId, initialData, editedTexts]);

  // Check if any text has changed
  const hasChanges = useMemo(() => {
    return Object.keys(editedTexts).some(
      (nodeId) => editedTexts[nodeId] !== initialTexts[nodeId]
    );
  }, [editedTexts, initialTexts]);

  const handleTextChange = useCallback((nodeId: string, text: string) => {
    if (text.length <= MAX_CHARS) {
      setEditedTexts((prev) => ({ ...prev, [nodeId]: text }));
    }
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Only send messages that changed
      const updates: ReminderMessageUpdate[] = Object.keys(editedTexts)
        .filter((nodeId) => editedTexts[nodeId] !== initialTexts[nodeId])
        .map((nodeId) => ({ node_id: nodeId, text: editedTexts[nodeId] }));

      if (updates.length === 0) return;

      await updateReminders(updates);
      toast({
        title: "Mensajes actualizados",
        description: `Se actualizaron ${updates.length} mensaje${updates.length > 1 ? "s" : ""} correctamente.`,
      });

      // Update initial texts to reflect saved state
      Object.assign(initialTexts, editedTexts);
      // Force re-render for hasChanges
      setEditedTexts({ ...editedTexts });
    } catch (error) {
      toast({
        title: "Error al guardar",
        description:
          error instanceof Error ? error.message : "No se pudieron actualizar los mensajes.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Empty state: no workflow configured
  if (!initialData.workflow_configured) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Recordatorios
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los mensajes de seguimiento automatico
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="p-3 rounded-full bg-muted">
              <Info className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-lg font-medium text-foreground">
              Recordatorios no configurados
            </p>
            <p className="text-sm text-muted-foreground text-center max-w-md">
              Tu cuenta no tiene un flujo de recordatorios configurado.
              Contacta al equipo de VentIA para activar esta funcionalidad.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Empty state: workflow exists but no messages found
  if (temperatures.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Clock className="h-6 w-6" />
            Recordatorios
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestiona los mensajes de seguimiento automatico
          </p>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 gap-3">
            <p className="text-muted-foreground">
              No se encontraron mensajes de recordatorio en el flujo configurado.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Clock className="h-6 w-6" />
          Recordatorios
        </h1>
        <p className="text-sm text-muted-foreground">
          Edita los mensajes de seguimiento automatico por temperatura y ventana de tiempo.
        </p>
      </div>

      <div className="flex gap-6">
        {/* Left: Editor */}
        <div className="flex-1 min-w-0">
          <Tabs defaultValue={temperatures[0]}>
            <TabsList className="w-full">
              {temperatures.map((temp) => (
                <TabsTrigger key={temp} value={temp}>
                  {getTempDisplay(temp)}
                </TabsTrigger>
              ))}
            </TabsList>

            {temperatures.map((temp) => (
              <TabsContent key={temp} value={temp}>
                <div className="space-y-4 mt-4">
                  {initialData.windows.map((win) => {
                    const msg = win.messages.find((m) => m.temperature === temp);
                    if (!msg) {
                      return (
                        <Card key={win.window} className="border-dashed opacity-60">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center justify-between">
                              <span className="flex items-center gap-2">
                                <span className="text-muted-foreground font-mono text-sm bg-muted px-2 py-0.5 rounded">
                                  {win.window + 1}
                                </span>
                                {getWindowLabel(win.window_label)}
                              </span>
                            </CardTitle>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground italic">
                              Sin recordatorio para esta ventana.
                            </p>
                          </CardContent>
                        </Card>
                      );
                    }

                    const text = editedTexts[msg.node_id] ?? msg.text;
                    const charCount = text.length;

                    return (
                      <Card
                        key={win.window}
                        className={activeNodeId === msg.node_id ? "ring-2 ring-aqua/40" : ""}
                      >
                        <CardHeader className="pb-3">
                          <CardTitle className="text-base flex items-center justify-between">
                            <span className="flex items-center gap-2">
                              <span className="text-muted-foreground font-mono text-sm bg-muted px-2 py-0.5 rounded">
                                {win.window + 1}
                              </span>
                              {getWindowLabel(win.window_label)}
                            </span>
                            <Badge
                              variant="outline"
                              className={getTempColor(temp)}
                            >
                              {getTempDisplay(temp)}
                            </Badge>
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <Textarea
                            value={text}
                            onChange={(e) => handleTextChange(msg.node_id, e.target.value)}
                            onFocus={() => setActiveNodeId(msg.node_id)}
                            rows={4}
                            className="resize-none"
                            placeholder="Escribe el mensaje de recordatorio..."
                          />
                          <div className="flex justify-end">
                            <span
                              className={`text-xs ${
                                charCount > MAX_CHARS * 0.9
                                  ? "text-danger"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {charCount}/{MAX_CHARS}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </TabsContent>
            ))}
          </Tabs>

          {/* Save button */}
          <div className="flex justify-end mt-6">
            <Button
              onClick={handleSave}
              disabled={!hasChanges || isSaving}
              className="gap-2"
            >
              <Save className="h-4 w-4" />
              {isSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </div>
        </div>

        {/* Right: WhatsApp-style Preview */}
        <div className="w-80 shrink-0 hidden lg:block">
          <div className="sticky top-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Previsualizacion</CardTitle>
              </CardHeader>
              <CardContent>
                {activePreview ? (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-aqua">
                      {activePreview.windowLabel}
                    </p>
                    {/* WhatsApp bubble */}
                    <div className="bg-cielo/30 border border-aqua/20 rounded-xl rounded-tl-sm px-4 py-3 shadow-sm">
                      <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                        {activePreview.text || (
                          <span className="text-muted-foreground italic">
                            Escribe un mensaje para ver la previsualizacion...
                          </span>
                        )}
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-2">
                        <span className="text-[10px] text-muted-foreground">
                          {getCurrentTime()}
                        </span>
                        <Check className="h-3 w-3 text-aqua" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center">
                    <p className="text-sm text-muted-foreground">
                      Haz clic en un mensaje para ver como se vera.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
