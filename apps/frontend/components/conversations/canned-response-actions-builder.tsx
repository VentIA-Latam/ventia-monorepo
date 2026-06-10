"use client";

import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  CannedResponseAction,
  CannedResponseActionName,
  Label as MessagingLabel,
} from "@/lib/types/messaging";

interface ActionDefinition {
  name: CannedResponseActionName;
  label: string;
  description: string;
}

// Acciones del v1. Espejo de CannedResponse::ACTION_NAMES en Rails.
const ACTION_DEFINITIONS: ActionDefinition[] = [
  { name: "add_label", label: "Agregar etiqueta", description: "Aplica una o más etiquetas a la conversación." },
  { name: "remove_label", label: "Quitar etiqueta", description: "Quita una o más etiquetas de la conversación." },
  { name: "set_ai_agent", label: "Cambiar agente / IA", description: "Pasa la conversación a IA o a agente humano." },
  { name: "change_status", label: "Cambiar estado", description: "Cambia el estado de la conversación." },
  { name: "resolve_conversation", label: "Resolver conversación", description: "Marca la conversación como resuelta." },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "open", label: "Abierta" },
  { value: "pending", label: "Pendiente" },
  { value: "resolved", label: "Resuelta" },
];

const AI_OPTIONS: { value: string; label: string }[] = [
  { value: "false", label: "Pasar a agente humano" },
  { value: "true", label: "Pasar a IA" },
];

function defaultParamsFor(name: CannedResponseActionName): Record<string, unknown> {
  switch (name) {
    case "add_label":
    case "remove_label":
      return { labels: [] };
    case "set_ai_agent":
      return { enabled: false };
    case "change_status":
      return { status: "open" };
    default:
      return {};
  }
}

interface CannedResponseActionsBuilderProps {
  value: CannedResponseAction[];
  onChange: (actions: CannedResponseAction[]) => void;
  labels: MessagingLabel[];
  disabled?: boolean;
}

export function CannedResponseActionsBuilder({
  value,
  onChange,
  labels,
  disabled,
}: CannedResponseActionsBuilderProps) {
  const updateAction = useCallback(
    (index: number, next: CannedResponseAction) => {
      onChange(value.map((a, i) => (i === index ? next : a)));
    },
    [value, onChange]
  );

  const updateParams = useCallback(
    (index: number, params: Record<string, unknown>) => {
      updateAction(index, { ...value[index], action_params: params });
    },
    [value, updateAction]
  );

  const changeType = useCallback(
    (index: number, name: CannedResponseActionName) => {
      updateAction(index, { action_name: name, action_params: defaultParamsFor(name) });
    },
    [updateAction]
  );

  const addAction = useCallback(() => {
    onChange([...value, { action_name: "add_label", action_params: defaultParamsFor("add_label") }]);
  }, [value, onChange]);

  const removeAction = useCallback(
    (index: number) => {
      onChange(value.filter((_, i) => i !== index));
    },
    [value, onChange]
  );

  const toggleLabel = useCallback(
    (index: number, labelId: number) => {
      const current = (value[index].action_params.labels as number[] | undefined) ?? [];
      const next = current.includes(labelId)
        ? current.filter((id) => id !== labelId)
        : [...current, labelId];
      updateParams(index, { ...value[index].action_params, labels: next });
    },
    [value, updateParams]
  );

  return (
    <div className="space-y-3">
      {value.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Sin acciones. Esta respuesta solo insertará texto al usarse.
        </p>
      ) : (
        <div className="space-y-3">
          {value.map((action, index) => {
            const selectedLabels = (action.action_params.labels as number[] | undefined) ?? [];
            return (
              <div
                key={index}
                className="rounded-lg border border-border/60 p-3 space-y-3 bg-muted/20"
              >
                <div className="flex items-center gap-2">
                  <Zap className="h-3.5 w-3.5 text-volt shrink-0" />
                  <Select
                    value={action.action_name}
                    onValueChange={(v) => changeType(index, v as CannedResponseActionName)}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-sm flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ACTION_DEFINITIONS.map((def) => (
                        <SelectItem key={def.name} value={def.name}>
                          {def.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0 text-destructive hover:text-destructive"
                    onClick={() => removeAction(index)}
                    disabled={disabled}
                    title="Quitar acción"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {/* Params per action type */}
                {(action.action_name === "add_label" || action.action_name === "remove_label") && (
                  <div className="space-y-1.5">
                    {labels.length === 0 ? (
                      <p className="text-[11px] text-muted-foreground">No hay etiquetas disponibles.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {labels.map((label) => {
                          const active = selectedLabels.includes(label.id);
                          return (
                            <button
                              key={label.id}
                              type="button"
                              disabled={disabled}
                              onClick={() => toggleLabel(index, label.id)}
                              className={cn(
                                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                                active
                                  ? "border-volt bg-volt/10 text-foreground"
                                  : "border-border/60 text-muted-foreground hover:bg-muted/50"
                              )}
                            >
                              <span
                                className="h-2 w-2 rounded-full shrink-0"
                                style={{ backgroundColor: label.color }}
                              />
                              {label.title}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {action.action_name === "set_ai_agent" && (
                  <Select
                    value={String(action.action_params.enabled ?? false)}
                    onValueChange={(v) => updateParams(index, { enabled: v === "true" })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {AI_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {action.action_name === "change_status" && (
                  <Select
                    value={String(action.action_params.status ?? "open")}
                    onValueChange={(v) => updateParams(index, { status: v })}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {action.action_name === "resolve_conversation" && (
                  <p className="text-[11px] text-muted-foreground">
                    Marca la conversación como resuelta. No requiere parámetros.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={addAction}
        disabled={disabled}
      >
        <Plus className="h-3.5 w-3.5" />
        Agregar acción
      </Button>
    </div>
  );
}
