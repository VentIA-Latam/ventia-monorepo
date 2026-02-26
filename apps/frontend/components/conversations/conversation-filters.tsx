"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Tag, CalendarDays, SlidersHorizontal, Snowflake, Thermometer, Flame, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
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

export function ConversationFilters({ allLabels, filters, onChange }: ConversationFiltersProps) {
  const [labelOpen, setLabelOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);

  const [dateRange, setDateRange] = useState<DateRange | undefined>(
    filters.dateRange
      ? { from: new Date(filters.dateRange.from), to: new Date(filters.dateRange.to) }
      : undefined
  );

  const hasActiveFilters = filters.label || filters.temperature || filters.dateRange || filters.unread;

  const handleLabelSelect = (title: string) => {
    onChange({ ...filters, label: filters.label === title ? undefined : title });
    setLabelOpen(false);
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

  return (
    <div className="px-3 pb-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
      {/* Label filter */}
      <Popover open={labelOpen} onOpenChange={setLabelOpen}>
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
        <PopoverContent align="start" className="w-48 p-2">
          {allLabels.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-2">Sin etiquetas</p>
          ) : (
            <div className="space-y-0.5">
              {allLabels.map((label) => (
                <button
                  key={label.id}
                  onClick={() => handleLabelSelect(label.title)}
                  className={cn(
                    "w-full flex items-center gap-2 text-xs px-2 py-1.5 rounded-md transition-colors text-left",
                    filters.label === label.title
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted/50"
                  )}
                >
                  <span
                    className="h-2.5 w-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.title}
                </button>
              ))}
            </div>
          )}
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
