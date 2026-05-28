"use client";

import { useEffect, useCallback, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart as PieIcon } from "lucide-react";
import type {
  ConversationDistributionResponse,
  DistributionCategoryKey,
} from "@/lib/services/metrics-service";

const CATEGORY_META: Record<
  DistributionCategoryKey,
  { label: string; color: string }
> = {
  agent_ai: { label: "IA", color: "oklch(0.58 0.19 260)" },
  human_support: { label: "Humano", color: "oklch(0.72 0.12 200)" },
  abandoned: { label: "Abandonadas", color: "oklch(0.72 0.15 60)" },
};

const CATEGORY_ORDER: DistributionCategoryKey[] = [
  "agent_ai",
  "human_support",
  "abandoned",
];

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  return `${hours.toLocaleString("es-PE", { maximumFractionDigits: 1 })} h`;
}

interface Props {
  startDate: string;
  endDate: string;
}

export function ConversationDistributionWidget({ startDate, endDate }: Props) {
  const [data, setData] = useState<ConversationDistributionResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);

  const fetchData = useCallback(async (start: string, end: string, signal: AbortSignal) => {
    setLoading(true);
    setFetchError(false);
    try {
      const params = new URLSearchParams({ period: "custom", start_date: start, end_date: end });
      const res = await fetch(`/api/metrics/conversation-distribution?${params}`, { signal });
      if (!res.ok) throw new Error("fetch failed");
      const json: ConversationDistributionResponse = await res.json();
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
    fetchData(startDate, endDate, controller.signal);
    return () => controller.abort();
  }, [startDate, endDate, fetchData]);

  const [activeKey, setActiveKey] = useState<DistributionCategoryKey | null>(null);

  const total = data?.total_conversations ?? 0;
  const isEmpty = !data || total === 0;

  // Datos para el pie en el orden canónico, solo categorías con valor > 0.
  const chartData = data
    ? CATEGORY_ORDER.map((key) => {
        const item = data.distribution.find((d) => d.category === key);
        return {
          key,
          label: CATEGORY_META[key].label,
          color: CATEGORY_META[key].color,
          count: item?.count ?? 0,
          percentage: item?.percentage ?? 0,
          total_hours: item?.total_hours ?? 0,
        };
      })
    : [];

  const slices = chartData.filter((d) => d.count > 0);

  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="pb-3">
        <div>
          <CardTitle className="text-base font-semibold">
            Distribución de conversaciones
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">
            IA vs Humano vs Abandonadas
          </p>
        </div>
      </CardHeader>

      <CardContent className="pt-0">
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-foreground" />
          </div>
        ) : fetchError ? (
          <div className="flex flex-col items-center py-12 text-center">
            <PieIcon className="h-8 w-8 text-destructive/40 mb-2" />
            <p className="text-sm text-muted-foreground">No se pudieron cargar los datos</p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center py-12 text-center">
            <PieIcon className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Sin conversaciones en este período
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-5 py-4">
            {/* Donut con total al centro */}
            <div className="relative h-[220px] w-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={slices}
                    dataKey="count"
                    nameKey="label"
                    innerRadius={72}
                    outerRadius={105}
                    paddingAngle={slices.length > 1 ? 2 : 0}
                    strokeWidth={0}
                    startAngle={90}
                    endAngle={-270}
                  >
                    {slices.map((d) => (
                      <Cell
                        key={d.key}
                        fill={d.color}
                        opacity={activeKey && activeKey !== d.key ? 0.45 : 1}
                        onMouseEnter={() => setActiveKey(d.key)}
                        onMouseLeave={() => setActiveKey(null)}
                        style={{ cursor: "pointer", outline: "none" }}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-semibold tabular-nums">
                  {total.toLocaleString("es-PE")}
                </span>
                <span className="text-xs text-muted-foreground mt-0.5">conversaciones</span>
              </div>
            </div>

            {/* Info del sector activo */}
            <div className="h-9 flex flex-col items-center justify-center text-center">
              {activeKey ? (() => {
                const d = chartData.find(c => c.key === activeKey)!;
                return (
                  <>
                    <p className="text-sm font-medium" style={{ color: d.color }}>{d.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {d.count.toLocaleString("es-PE")} conv. · {d.percentage.toLocaleString("es-PE", { maximumFractionDigits: 1 })}% · {formatHours(d.total_hours)}
                    </p>
                  </>
                );
              })() : <span className="text-xs text-muted-foreground/40">Pasa el ratón sobre un sector</span>}
            </div>

            {/* Leyenda simple abajo */}
            <div className="flex flex-wrap justify-center gap-x-5 gap-y-1.5">
              {chartData.map((d) => (
                <div key={d.key} className="flex items-center gap-1.5">
                  <span
                    className="h-3 w-3 rounded-sm shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-xs text-muted-foreground">{d.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
