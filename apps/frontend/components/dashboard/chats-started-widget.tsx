"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { MessageSquareText, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ChatsStartedResponse } from "@/lib/services/metrics-service";

const ALL_INBOXES = "all";

const CHANNEL_LABEL: Record<string, string> = {
  "Channel::Whatsapp": "WhatsApp",
  "Channel::Instagram": "Instagram",
};

function inboxLabel(inbox: { name: string; channel_type: string; identifier: string | null }): string {
  const channel = CHANNEL_LABEL[inbox.channel_type] ?? inbox.channel_type;
  return inbox.identifier ? `${channel} · ${inbox.identifier}` : `${channel} · ${inbox.name}`;
}

// "2026-06-01" → "01/06" (sin pasar por Date para evitar saltos de timezone)
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

// "2026-06-01" → "Lunes" (constructor de hora local para evitar desfase UTC→local)
function dayOfWeek(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const idx = new Date(y, m - 1, d).getDay();
  return ["Domingo","Lunes","Martes","Miércoles","Jueves","Viernes","Sábado"][idx];
}

// Fecha de hoy en formato DD/MM/YYYY (hora local)
function todayFormatted(): string {
  const now = new Date();
  const d = String(now.getDate()).padStart(2, "0");
  const mo = String(now.getMonth() + 1).padStart(2, "0");
  return `${d}/${mo}/${now.getFullYear()}`;
}

interface Props {
  startDate: string;
  endDate: string;
}

export function ChatsStartedWidget({ startDate, endDate }: Props) {
  const [data, setData] = useState<ChatsStartedResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [inboxId, setInboxId] = useState<string>(ALL_INBOXES);

  const fetchData = useCallback(
    async (start: string, end: string, inbox: string, signal: AbortSignal) => {
      setLoading(true);
      setFetchError(false);
      try {
        const params = new URLSearchParams({
          period: "custom",
          start_date: start,
          end_date: end,
        });
        if (inbox !== ALL_INBOXES) params.append("inbox_id", inbox);

        const res = await fetch(`/api/metrics/chats-started?${params}`, { signal });
        if (!res.ok) throw new Error("fetch failed");
        const json: ChatsStartedResponse = await res.json();
        setData(json);
        setLoading(false);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        setData(null);
        setFetchError(true);
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchData(startDate, endDate, inboxId, controller.signal);
    return () => controller.abort();
  }, [startDate, endDate, inboxId, fetchData]);

  const total = data?.total ?? 0;
  // La serie siempre trae los días rellenados en 0, así que "vacío" se decide por
  // el total real de chats, no por la longitud de results.
  const isEmpty = !data || total === 0;
  const inboxes = useMemo(() => data?.available_inboxes ?? [], [data]);

  // Si cambia el rango y el inbox seleccionado ya no está disponible, volver a "todos".
  useEffect(() => {
    if (inboxId !== ALL_INBOXES && data && !inboxes.some((i) => String(i.id) === inboxId)) {
      setInboxId(ALL_INBOXES);
    }
  }, [data, inboxes, inboxId]);

  const chartData = useMemo(
    () => (data?.results ?? []).map((r) => ({ ...r, label: shortDate(r.date) })),
    [data]
  );

  const exportCsv = useCallback(() => {
    if (!data || total === 0) return;

    const canalLabel =
      inboxId === ALL_INBOXES
        ? "Todos los canales"
        : inboxLabel(inboxes.find((i) => String(i.id) === inboxId)!);

    const header = [
      `Reporte,Chats iniciados por día`,
      `Período,${startDate} al ${endDate}`,
      `Canal,${canalLabel}`,
      `Exportado,${todayFormatted()}`,
      "",
    ].join("\n");

    const cols = "fecha,dia_semana,chats,acumulado,pct_total";

    let running = 0;
    const rows = data.results.map((r) => {
      running += r.count;
      const pct = (r.count / total * 100).toFixed(1);
      return `${r.date},${dayOfWeek(r.date)},${r.count},${running},${pct}%`;
    });

    const avg = (total / data.results.length).toFixed(1);
    const summary = ["", `TOTAL,,${total},,100.0%`, `PROMEDIO,,${avg},,`].join("\n");

    const csv = [header, cols, ...rows, summary].join("\n");
    // "sep=," en la primera línea le indica a Excel qué delimitador usar,
    // independientemente de la configuración regional (Latin America usa ";" por defecto).
    const blob = new Blob([`﻿sep=,\n${csv}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chats-iniciados_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [data, total, inboxId, inboxes, startDate, endDate]);

  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base font-semibold">Chats iniciados por día</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {total.toLocaleString("es-PE")} chats en el período
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Select value={inboxId} onValueChange={setInboxId}>
              <SelectTrigger className="h-8 w-[170px] text-xs" aria-label="Canal">
                <SelectValue placeholder="Canal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_INBOXES}>Todos los canales</SelectItem>
                {inboxes.map((i) => (
                  <SelectItem key={i.id} value={String(i.id)}>
                    {inboxLabel(i)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs"
              onClick={exportCsv}
              disabled={isEmpty}
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </Button>
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
            <MessageSquareText className="h-8 w-8 text-destructive/40 mb-2" />
            <p className="text-sm text-muted-foreground">No se pudieron cargar los datos</p>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center py-12 text-center">
            <MessageSquareText className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">Sin chats en el período seleccionado</p>
          </div>
        ) : (
          <div className="h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="chatsStartedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="var(--volt)" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="var(--volt)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  minTickGap={24}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
                />
                <Tooltip content={<ChatsTooltip />} cursor={{ stroke: "var(--volt)", strokeOpacity: 0.3 }} />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="var(--volt)"
                  strokeWidth={2}
                  fill="url(#chatsStartedFill)"
                  dot={false}
                  activeDot={{ r: 4, fill: "var(--volt)" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface TooltipPayloadItem {
  payload: { date: string; count: number };
}

function ChatsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: TooltipPayloadItem[];
}) {
  if (!active || !payload?.length) return null;
  const { date, count } = payload[0].payload;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <p className="font-medium text-popover-foreground">{date}</p>
      <p className="text-muted-foreground">
        {count.toLocaleString("es-PE")} {count === 1 ? "chat" : "chats"}
      </p>
    </div>
  );
}
