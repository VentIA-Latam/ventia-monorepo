"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Tag, CalendarDays, SlidersHorizontal, Snowflake, Thermometer, Flame, X, Trash2, Lock, Plus } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { createLabel, deleteLabel } from "@/lib/api-client/messaging";
import type { DateRange } from "react-day-picker";
import type { Label, ConversationTemperature } from "@/lib/types/messaging";

export interface ActiveFilters {
  label?: string;
  temperature?: ConversationTemperature;
  dateRange?: { from: string; to: string };
  unread?: boolean;
}

interface ConversationFiltersProps {
  allLabels: Label[];
  filters: ActiveFilters;
  onChange: (filters: ActiveFilters) => void;
  onLabelCreated?: (label: Label) => void;
  onLabelDeleted?: (labelId: number) => void;
}

const TEMP_OPTIONS: {
  value: ConversationTemperature;
  label: string;
  icon: typeof Snowflake;
}[] = [
  { value: "cold", label: "Frío", icon: Snowflake },
  { value: "warm", label: "Tibio", icon: Thermometer },
  { value: "hot", label: "Caliente", icon: Flame },
];

const PRESET_COLORS = [
  "#1f93ff", "#4CAF50", "#FF9800", "#E91E63",
  "#9C27B0", "#00BCD4", "#795548", "#607D8B",
];

const RESERVED_LABEL_NAMES = ["soporte-humano", "en-revisión"];

export function ConversationFilters({ allLabels, filters, onChange, onLabelCreated, onLabelDeleted }: ConversationFiltersProps) {
  const [labelOpen, setLabelOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    filters.dateRange
      ? { from: new Date(filters.dateRange.from), to: new Date(filters.dateRange.to) }
      : undefined
  );

  const hasActiveFilters = filters.label || filters.temperature || filters.dateRange || filters.unread;
  const isReservedName = RESERVED_LABEL_NAMES.includes(newTitle.trim().toLowerCase());

  const handleLabelSelect = (title: string) => {
    onChange({ ...filters, label: filters.label === title ? undefined : title });
  };

  const handleDateSelect = (range: DateRange | undefined) => {
    setDateRange(range);
    if (range?.from && range?.to) {
      onChange({
        ...filters,
        dateRange: {
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        },
      });
    } else if (!range?.from && !range?.to) {
      onChange({ ...filters, dateRange: undefined });
    }
  };

  const handleTempSelect = (temp: ConversationTemperature) => {
    onChange({ ...filters, temperature: filters.temperature === temp ? undefined : temp });
    setFilterOpen(false);
  };

  const handleUnreadToggle = () => {
    onChange({ ...filters, unread: filters.unread ? undefined : true });
    setFilterOpen(false);
  };

  const clearAll = () => {
    setDateRange(undefined);
    onChange({});
  };

  const handleCreate = useCallback(async () => {
    if (!newTitle.trim() || isReservedName) return;
    setCreating(true);
    try {
      const result = await createLabel({ title: newTitle.trim(), color: newColor });
      const created = (result as { data: Label }).data;
      if (created?.id) {
        onLabelCreated?.(created);
        setNewTitle("");
        setShowCreate(false);
      }
    } catch (err) {
      console.error("Error creating label:", err);
    } finally {
      setCreating(false);
    }
  }, [newTitle, newColor, isReservedName, onLabelCreated]);

  const handleDelete = useCallback(async (label: Label) => {
    if (label.system) return;
    setDeleting(label.id);
    try {
      await deleteLabel(label.id);
      onLabelDeleted?.(label.id);
      if (filters.label === label.title) {
        onChange({ ...filters, label: undefined });
      }
    } catch (err) {
      console.error("Error deleting label:", err);
    } finally {
      setDeleting(null);
    }
  }, [onLabelDeleted, filters, onChange]);

  return (
    <div className="px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      {/* Label filter + management */}
      <Popover open={labelOpen} onOpenChange={(open) => { setLabelOpen(open); if (!open) setShowCreate(false); }}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 px-2.5 text-xs gap-1 shrink-0 rounded-full",
              filters.label && "bg-primary/10 border-primary/30 text-primary"
            )}
          >
            <Tag className="h-3 w-3" />
            {filters.label || "Etiquetas"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-56 p-2">
          {/* Label list */}
          {allLabels.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Sin etiquetas</p>
          ) : (
            <div className="space-y-0.5 max-h-48 overflow-y-auto">
              {allLabels.map((label) => (
                <div
                  key={label.id}
                  className="group flex items-center gap-1"
                >
                  <button
                    onClick={() => handleLabelSelect(label.title)}
                    className={cn(
                      "flex-1 flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-left min-w-0",
                      filters.label === label.title
                        ? "bg-primary/10 text-primary"
                        : "hover:bg-muted/50"
                    )}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: label.color }}
                    />
                    <span className="truncate">{label.title}</span>
                  </button>
                  {label.system ? (
                    <Lock className="h-3 w-3 text-muted-foreground/50 shrink-0 mr-1" />
                  ) : (
                    <button
                      onClick={() => handleDelete(label)}
                      disabled={deleting === label.id}
                      className="shrink-0 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Create section */}
          <div className="border-t mt-2 pt-2">
            {showCreate ? (
              <div className="space-y-2">
                <Input
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  placeholder="Nombre de la etiqueta"
                  className="h-7 text-xs"
                  autoFocus
                  onKeyDown={(e) => e.key === "Enter" && handleCreate()}
                />
                <div className="flex gap-1">
                  {PRESET_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setNewColor(color)}
                      className="h-4 w-4 rounded-full border-2 transition-transform hover:scale-110"
                      style={{
                        backgroundColor: color,
                        borderColor: newColor === color ? "white" : "transparent",
                        boxShadow: newColor === color ? `0 0 0 1.5px ${color}` : "none",
                      }}
                    />
                  ))}
                </div>
                {isReservedName && (
                  <p className="text-[11px] text-destructive">Nombre reservado.</p>
                )}
                <div className="flex gap-1">
                  <Button
                    size="sm"
                    className="flex-1 h-6 text-xs"
                    onClick={handleCreate}
                    disabled={!newTitle.trim() || creating || isReservedName}
                  >
                    {creating ? "..." : "Crear"}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 text-xs px-2"
                    onClick={() => { setShowCreate(false); setNewTitle(""); }}
                  >
                    Cancelar
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowCreate(true)}
                className="w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md text-muted-foreground hover:bg-muted/50 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Crear etiqueta
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {/* Date range filter */}
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 px-2.5 text-xs gap-1 shrink-0 rounded-full",
              filters.dateRange && "bg-primary/10 border-primary/30 text-primary"
            )}
          >
            <CalendarDays className="h-3 w-3" />
            {filters.dateRange
              ? `${format(new Date(filters.dateRange.from), "dd/MM", { locale: es })} - ${format(new Date(filters.dateRange.to), "dd/MM", { locale: es })}`
              : "Fecha"}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={handleDateSelect}
            locale={es}
            numberOfMonths={1}
          />
          {dateRange && (
            <div className="px-3 pb-3">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={() => {
                  setDateRange(undefined);
                  onChange({ ...filters, dateRange: undefined });
                }}
              >
                Limpiar fechas
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {/* Temperature + unread filter */}
      <Popover open={filterOpen} onOpenChange={setFilterOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 px-2.5 text-xs gap-1 shrink-0 rounded-full",
              (filters.temperature || filters.unread) && "bg-primary/10 border-primary/30 text-primary"
            )}
          >
            <SlidersHorizontal className="h-3 w-3" />
            Filtros
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-48 p-2">
          <div className="space-y-0.5">
            <button
              onClick={handleUnreadToggle}
              className={cn(
                "w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-left",
                filters.unread ? "bg-primary/10 text-primary" : "hover:bg-muted/50"
              )}
            >
              No leídas
            </button>
            <div className="h-px bg-border my-1" />
            {TEMP_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleTempSelect(opt.value)}
                  className={cn(
                    "w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-left",
                    filters.temperature === opt.value
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear all button */}
      {hasActiveFilters && (
        <button
          onClick={clearAll}
          className="shrink-0 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="h-3 w-3" />
          Limpiar
        </button>
      )}
    </div>
  );
}
