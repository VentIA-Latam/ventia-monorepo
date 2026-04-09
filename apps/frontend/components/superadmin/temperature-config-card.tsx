"use client";

import { useEffect, useState, useCallback } from "react";
import { Thermometer, Plus, Trash2, Pencil, Loader2, RotateCcw, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { getTemperatureConfig, updateTemperatureConfig } from "@/lib/api-client/messaging";
import {
  TEMPERATURE_ICON_MAP,
  TEMPERATURE_ICON_NAMES,
  TEMPERATURE_PRESET_COLORS,
} from "@/lib/utils/temperature-icons";
import type { TemperatureDefinition } from "@/lib/types/messaging";

const MAX_TEMPERATURES = 5;

const DEFAULT_TEMPERATURES: TemperatureDefinition[] = [
  { key: "cold", name: "Frío", color: "#1f93ff", icon: "snowflake", position: 0 },
  { key: "warm", name: "Tibio", color: "#FF9800", icon: "thermometer", position: 1 },
  { key: "hot", name: "Caliente", color: "#E91E63", icon: "flame", position: 2 },
];

function toSnakeCase(str: string): string {
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .trim()
    .replace(/\s+/g, "_");
}

interface TemperatureFormState {
  name: string;
  color: string;
  icon: string;
}

const EMPTY_FORM: TemperatureFormState = {
  name: "",
  color: TEMPERATURE_PRESET_COLORS[0],
  icon: "star",
};

interface TemperatureConfigCardProps {
  tenantId: number;
}

export function TemperatureConfigCard({ tenantId }: TemperatureConfigCardProps) {
  const { toast } = useToast();
  const [config, setConfig] = useState<TemperatureDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state
  const [showForm, setShowForm] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState<TemperatureFormState>(EMPTY_FORM);

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const result = await getTemperatureConfig(tenantId);
      setConfig(result.data ?? []);
    } catch {
      toast({ variant: "destructive", title: "Error al cargar configuración de temperaturas" });
    } finally {
      setLoading(false);
    }
  }, [tenantId, toast]);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const saveConfig = useCallback(
    async (newConfig: TemperatureDefinition[]) => {
      setSaving(true);
      try {
        const result = await updateTemperatureConfig(newConfig, tenantId);
        setConfig(result.data ?? newConfig);
        toast({ title: "Configuración de temperaturas guardada" });
      } catch {
        toast({ variant: "destructive", title: "Error al guardar configuración" });
      } finally {
        setSaving(false);
      }
    },
    [tenantId, toast]
  );

  const handleAdd = useCallback(() => {
    if (!form.name.trim()) return;

    const key = toSnakeCase(form.name);
    if (config.some((t) => t.key === key)) {
      toast({ variant: "destructive", title: `Ya existe una temperatura con key "${key}"` });
      return;
    }

    const newEntry: TemperatureDefinition = {
      key,
      name: form.name.trim(),
      color: form.color,
      icon: form.icon,
      position: config.length,
    };

    const newConfig = [...config, newEntry];
    saveConfig(newConfig);
    setForm(EMPTY_FORM);
    setShowForm(false);
  }, [form, config, saveConfig, toast]);

  const handleEdit = useCallback(() => {
    if (!form.name.trim() || !editingKey) return;

    const key = toSnakeCase(form.name);
    if (key !== editingKey && config.some((t) => t.key === key)) {
      toast({ variant: "destructive", title: `Ya existe una temperatura con key "${key}"` });
      return;
    }

    const newConfig = config.map((t) =>
      t.key === editingKey
        ? { ...t, key, name: form.name.trim(), color: form.color, icon: form.icon }
        : t
    );
    saveConfig(newConfig);
    setEditingKey(null);
    setShowForm(false);
    setForm(EMPTY_FORM);
  }, [form, editingKey, config, saveConfig, toast]);

  const handleDelete = useCallback(
    (key: string) => {
      const newConfig = config
        .filter((t) => t.key !== key)
        .map((t, idx) => ({ ...t, position: idx }));
      saveConfig(newConfig);
    },
    [config, saveConfig]
  );

  const startEdit = useCallback((temp: TemperatureDefinition) => {
    setEditingKey(temp.key);
    setForm({ name: temp.name, color: temp.color, icon: temp.icon });
    setShowForm(true);
  }, []);

  const handleLoadDefaults = useCallback(() => {
    saveConfig(DEFAULT_TEMPERATURES);
  }, [saveConfig]);

  const cancelForm = useCallback(() => {
    setShowForm(false);
    setEditingKey(null);
    setForm(EMPTY_FORM);
  }, []);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Thermometer className="h-5 w-5 text-muted-foreground" />
            <div>
              <CardTitle>Configuración de Temperaturas</CardTitle>
              <CardDescription>
                Clasificaciones disponibles para las conversaciones de este tenant
              </CardDescription>
            </div>
          </div>
          <Badge variant={config.length > 0 ? "success" : "outline"} className={config.length === 0 ? "bg-muted/50" : ""}>
            {config.length}/{MAX_TEMPERATURES} configuradas
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : (
          <>
            {/* Temperature list */}
            {config.length > 0 ? (
              <div className="space-y-2">
                {config
                  .sort((a, b) => a.position - b.position)
                  .map((temp) => {
                    const Icon = TEMPERATURE_ICON_MAP[temp.icon] ?? Thermometer;
                    return (
                      <div
                        key={temp.key}
                        className="flex items-center justify-between rounded-lg border px-3 py-2.5 transition-colors hover:bg-muted/30"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-8 w-8 items-center justify-center rounded-md"
                            style={{ backgroundColor: `${temp.color}18`, color: temp.color }}
                          >
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <p className="text-sm font-medium">{temp.name}</p>
                            <p className="text-xs text-muted-foreground font-mono">{temp.key}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => startEdit(temp)}
                            disabled={saving}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(temp.key)}
                            disabled={saving}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              <div className="text-center py-6">
                <Thermometer className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Sin temperaturas configuradas</p>
              </div>
            )}

            {/* Add/Edit form */}
            {showForm && (
              <>
                <Separator />
                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    {editingKey ? "Editar temperatura" : "Nueva temperatura"}
                  </p>

                  {/* Name */}
                  <div className="space-y-1.5">
                    <Label htmlFor="temp-name" className="text-xs">
                      Nombre
                    </Label>
                    <Input
                      id="temp-name"
                      placeholder="Ej: Interesado, Negociando..."
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      disabled={saving}
                    />
                    {form.name.trim() && (
                      <p className="text-xs text-muted-foreground">
                        Key: <code className="bg-muted px-1 rounded">{toSnakeCase(form.name)}</code>
                      </p>
                    )}
                  </div>

                  {/* Color picker */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Color</Label>
                    <div className="flex gap-2">
                      {TEMPERATURE_PRESET_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setForm((f) => ({ ...f, color }))}
                          className="h-7 w-7 rounded-full border-2 transition-all"
                          style={{
                            backgroundColor: color,
                            borderColor: form.color === color ? "white" : "transparent",
                            boxShadow:
                              form.color === color
                                ? `0 0 0 2px ${color}`
                                : "0 0 0 1px rgba(0,0,0,0.1)",
                          }}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Icon picker */}
                  <div className="space-y-1.5">
                    <Label className="text-xs">Icono</Label>
                    <div className="grid grid-cols-10 gap-1.5">
                      {TEMPERATURE_ICON_NAMES.map((iconName) => {
                        const IconComp = TEMPERATURE_ICON_MAP[iconName];
                        const isSelected = form.icon === iconName;
                        return (
                          <button
                            key={iconName}
                            type="button"
                            onClick={() => setForm((f) => ({ ...f, icon: iconName }))}
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-md border transition-all",
                              isSelected
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-transparent hover:bg-muted/50 text-muted-foreground"
                            )}
                            title={iconName}
                          >
                            <IconComp className="h-4 w-4" />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Preview */}
                  {form.name.trim() && (
                    <div className="space-y-1.5">
                      <Label className="text-xs">Vista previa</Label>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const PreviewIcon = TEMPERATURE_ICON_MAP[form.icon] ?? Thermometer;
                          return (
                            <div
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs font-medium"
                              style={{
                                backgroundColor: `${form.color}18`,
                                color: form.color,
                                borderColor: `${form.color}50`,
                              }}
                            >
                              <PreviewIcon className="h-3.5 w-3.5" />
                              {form.name.trim()}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-2 pt-1">
                    <Button
                      size="sm"
                      onClick={editingKey ? handleEdit : handleAdd}
                      disabled={saving || !form.name.trim()}
                    >
                      {saving ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="mr-2 h-4 w-4" />
                      )}
                      {editingKey ? "Guardar cambios" : "Agregar"}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={cancelForm} disabled={saving}>
                      <X className="mr-2 h-4 w-4" />
                      Cancelar
                    </Button>
                  </div>
                </div>
              </>
            )}

            {/* Bottom actions */}
            {!showForm && (
              <div className="flex items-center gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingKey(null);
                    setForm(EMPTY_FORM);
                    setShowForm(true);
                  }}
                  disabled={saving || config.length >= MAX_TEMPERATURES}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Agregar temperatura
                </Button>
                {config.length === 0 && (
                  <Button size="sm" variant="outline" onClick={handleLoadDefaults} disabled={saving}>
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Cargar defaults
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
