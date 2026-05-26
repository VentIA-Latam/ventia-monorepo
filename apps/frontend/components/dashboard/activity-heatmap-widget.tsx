"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ActivityByHourResponse } from "@/lib/services/metrics-service";

type Period = "last_7_days" | "last_30_days";

const DAY_LABELS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const DAY_NAMES  = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

// Horas con etiqueta visible en el eje Y
const LABELED_HOURS: Record<number, string> = {
  0:  "12 AM",
  6:  "6 AM",
  12: "12 PM",
  18: "6 PM",
};

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = [0, 1, 2, 3, 4, 5, 6];

const VOLT_HUE = 260;
const VOLT_STEPS = [
  `oklch(0.90 0.05 ${VOLT_HUE})`,
  `oklch(0.80 0.09 ${VOLT_HUE})`,
  `oklch(0.72 0.13 ${VOLT_HUE})`,
  `oklch(0.65 0.16 ${VOLT_HUE})`,
  `oklch(0.58 0.19 ${VOLT_HUE})`,
] as const;

function getCellStyle(count: number, maxCount: number): { backgroundColor?: string } {
  if (count === 0 || maxCount === 0) return {};
  const ratio = count / maxCount;
  const idx =
    ratio <= 0.15 ? 0 :
    ratio <= 0.30 ? 1 :
    ratio <= 0.50 ? 2 :
    ratio <= 0.70 ? 3 : 4;
  return { backgroundColor: VOLT_STEPS[idx] };
}

function findPeak(matrix: number[][]): { day: number; hour: number; count: number } | null {
  let max = 0;
  let day = 0;
  let hour = 0;
  for (let d = 0; d < matrix.length; d++) {
    for (let h = 0; h < (matrix[d]?.length ?? 0); h++) {
      if (matrix[d][h] > max) {
        max = matrix[d][h];
        day = d;
        hour = h;
      }
    }
  }
  return max === 0 ? null : { day, hour, count: max };
}

export function ActivityHeatmapWidget() {
  const [period, setPeriod] = useState<Period>("last_7_days");
  const [data, setData] = useState<ActivityByHourResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchData = useCallback(async (p: Period, signal: AbortSignal) => {
    setLoading(true);
    setFetchError(false);
    try {
      const res = await fetch(`/api/metrics/activity-by-hour?period=${p}`, { signal });
      if (!res.ok) throw new Error("fetch failed");
      const json: ActivityByHourResponse = await res.json();
      setData(json);
      setLoading(false);
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      setData(null);
      setFetchError(true);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchData(period, controller.signal);
    return () => controller.abort();
  }, [period, fetchData]);

  const peak = data?.matrix ? findPeak(data.matrix) : null;
  const isEmpty = !data || data.max_count === 0;

  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <CardTitle className="text-base font-semibold">Actividad por hora</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Distribución de mensajes por día y hora
              {data?.timezone_note && ` (${data.timezone_note})`}
            </p>
          </div>

          {/* Selector de período propio */}
          <div className="flex items-center gap-1 rounded-md border border-border p-0.5 shrink-0">
            {(["last_7_days", "last_30_days"] as Period[]).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  period === p
                    ? "bg-foreground text-background"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p === "last_7_days" ? "7 días" : "30 días"}
              </button>
            ))}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Clock className="h-8 w-8 text-destructive/40 mb-2" />
            <p className="text-sm text-muted-foreground">No se pudieron cargar los datos</p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center py-12 text-center">
            <Clock className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Sin actividad en este período</p>
          </div>
        ) : (
          <TooltipProvider delayDuration={0}>
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Header: horas como columnas */}
                <div className="flex">
                  <div className="w-12 shrink-0" />
                  {HOURS.map((hour) => (
                    <div
                      key={hour}
                      className="flex-1 text-center text-[10px] text-muted-foreground pb-2 leading-none"
                    >
                      {LABELED_HOURS[hour] ?? ""}
                    </div>
                  ))}
                </div>

                {/* Filas: días */}
                {DAYS.map((dow) => (
                  <div key={dow} className="flex items-center gap-px mb-px">
                    {/* Etiqueta de día */}
                    <div className="w-12 shrink-0 pr-2 text-right text-[10px] font-medium text-muted-foreground leading-none">
                      {DAY_LABELS[dow]}
                    </div>

                    {/* Celdas por hora */}
                    {HOURS.map((hour) => {
                      const count = data!.matrix[dow]?.[hour] ?? 0;
                      return (
                        <Tooltip key={hour}>
                          <TooltipTrigger asChild>
                            <div
                              className="flex-1 h-9 rounded-sm transition-colors cursor-default bg-[oklch(0.93_0.00_0)] dark:bg-[oklch(0.22_0.00_0)]"
                              style={getCellStyle(count, data!.max_count)}
                            />
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs">
                            <p className="font-medium">{DAY_NAMES[dow]} {hour}:00</p>
                            <p className="text-muted-foreground">
                              {count.toLocaleString("es-PE")} mensajes
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                ))}

                {/* Footer: leyenda + pico */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">Menos</span>
                    {[null, ...VOLT_STEPS].map((color, i) => (
                      <div
                        key={i}
                        className="h-3 w-4 rounded-sm bg-[oklch(0.93_0.00_0)] dark:bg-[oklch(0.22_0.00_0)]"
                        style={color ? { backgroundColor: color } : undefined}
                      />
                    ))}
                    <span className="text-[10px] text-muted-foreground">Más</span>
                  </div>

                  {peak && (
                    <p className="text-[11px] text-muted-foreground">
                      Pico: <span className="text-foreground font-medium">{DAY_NAMES[peak.day]}</span>{" "}
                      {peak.hour}:00 · {peak.count.toLocaleString("es-PE")} mensajes
                    </p>
                  )}
                </div>
              </div>
            </div>
          </TooltipProvider>
        )}
      </CardContent>
    </Card>
  );
}
