"use client";

import { useState, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Plus, X, Tag } from "lucide-react";
import { addConversationLabel, removeConversationLabel, createLabel } from "@/lib/api-client/messaging";
import type { Label } from "@/lib/types/messaging";

interface LabelManagerProps {
  conversationId: number;
  labels: Label[];
  allLabels: Label[];
  onChange?: (labels: Label[]) => void;
  onLabelsCreated?: (label: Label) => void;
}

const PRESET_COLORS = [
  "#1f93ff", "#4CAF50", "#FF9800", "#E91E63",
  "#9C27B0", "#00BCD4", "#795548", "#607D8B",
];

const RESERVED_LABEL_NAMES = ["soporte-humano", "en-revisión"];

export function LabelManager({
  conversationId,
  labels,
  allLabels,
  onChange,
  onLabelsCreated,
}: LabelManagerProps) {
  const [open, setOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);

  const availableLabels = allLabels.filter(
    (al) => !labels.some((l) => l.id === al.id)
  );

  const handleAdd = useCallback(
    async (label: Label) => {
      const updated = [...labels, label];
      onChange?.(updated);
      try {
        await addConversationLabel(conversationId, label.id);
      } catch (err) {
        console.error("Error adding label:", err);
        onChange?.(labels);
      }
    },
    [conversationId, labels, onChange]
  );

  const handleRemove = useCallback(
    async (labelId: number) => {
      const updated = labels.filter((l) => l.id !== labelId);
      onChange?.(updated);
      try {
        await removeConversationLabel(conversationId, labelId);
      } catch (err) {
        console.error("Error removing label:", err);
        onChange?.(labels);
      }
    },
    [conversationId, labels, onChange]
  );

  const isReservedName = RESERVED_LABEL_NAMES.includes(newTitle.trim().toLowerCase());

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || isReservedName) return;
    setCreating(true);
    try {
      const result = await createLabel({ title: newTitle.trim(), color: newColor });
      const created = (result as { data: Label }).data;
      if (created?.id) {
        onLabelsCreated?.(created);
        await addConversationLabel(conversationId, created.id);
        onChange?.([...labels, created]);
        setNewTitle("");
      }
    } catch (err) {
      console.error("Error creating label:", err);
    } finally {
      setCreating(false);
    }
  }, [newTitle, newColor, conversationId, labels, onChange, onLabelsCreated, isReservedName]);

  return (
    <div className="space-y-2">
      {/* Current labels */}
      <div className="flex flex-wrap gap-1.5">
        {labels.map((label) => (
          <Badge
            key={label.id}
            variant="outline"
            className="text-xs pl-2 pr-1 py-0.5 gap-1"
            style={{ borderColor: label.color, color: label.color }}
          >
            {label.title}
            <button
              onClick={() => handleRemove(label.id)}
              className="hover:opacity-70 transition-opacity"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}

        {/* Add button */}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs gap-1">
              <Plus className="h-3 w-3" />
              <Tag className="h-3 w-3" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 p-3 space-y-3">
            {/* Available labels to add */}
            {availableLabels.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Etiquetas disponibles</p>
                <div className="flex flex-wrap gap-1">
                  {availableLabels.map((label) => (
                    <button
                      key={label.id}
                      onClick={() => {
                        handleAdd(label);
                        setOpen(false);
                      }}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border hover:bg-muted/50 transition-colors"
                      style={{ borderColor: label.color, color: label.color }}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: label.color }}
                      />
                      {label.title}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Create new label */}
            <div className="space-y-2 pt-1 border-t">
              <p className="text-xs font-medium text-muted-foreground">Crear nueva</p>
              <Input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Nombre de la etiqueta"
                className="h-8 text-xs"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <div className="flex gap-1">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewColor(color)}
                    className="h-5 w-5 rounded-full border-2 transition-transform hover:scale-110"
                    style={{
                      backgroundColor: color,
                      borderColor: newColor === color ? "white" : "transparent",
                      boxShadow: newColor === color ? `0 0 0 2px ${color}` : "none",
                    }}
                  />
                ))}
              </div>
              {isReservedName && (
                <p className="text-[11px] text-destructive">
                  Nombre reservado para etiquetas del sistema.
                </p>
              )}
              <Button
                size="sm"
                className="w-full h-7 text-xs"
                onClick={handleCreate}
                disabled={!newTitle.trim() || creating || isReservedName}
              >
                {creating ? "Creando..." : "Crear y asignar"}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
