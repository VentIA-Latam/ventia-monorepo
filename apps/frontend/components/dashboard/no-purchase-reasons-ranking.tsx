"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageCircleOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { NoPurchaseReasonsResponse } from "@/lib/services/metrics-service";

interface NoPurchaseReasonsRankingProps {
  data?: NoPurchaseReasonsResponse;
}

const medalColors = [
  "bg-warning/15 text-warning border-warning/20",
  "bg-muted/80 text-muted-foreground border-border",
  "bg-volt/10 text-volt border-volt/20",
];

export function NoPurchaseReasonsRanking({ data }: NoPurchaseReasonsRankingProps) {
  if (!data || !data.results || data.results.length === 0 || data.total === 0) {
    return (
      <Card className="flex flex-col w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Motivos de no compra</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center pt-0">
          <div className="flex flex-col items-center py-10 text-center">
            <MessageCircleOff className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">
              Sin motivos registrados en este período
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const sorted = data.results.slice(0, 7);
  const totalReasons = data.results.length;

  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Motivos de no compra</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {data.total} {data.total === 1 ? "conversación" : "conversaciones"} sin compra
          {totalReasons > 7 && ` · Top 7 de ${totalReasons} motivos`}
        </p>
      </CardHeader>
      <CardContent className="flex-1 pt-0 space-y-5">
        {sorted.map((item, i) => (
          <div key={item.reason} className="space-y-1.5">
            <div className="flex items-center justify-between gap-2 pt-2.5">
              <div className="flex items-center gap-2 min-w-0 flex-1">
                {i < 3 ? (
                  <span
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold border",
                      medalColors[i]
                    )}
                  >
                    {i + 1}
                  </span>
                ) : (
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[10px] font-medium text-muted-foreground">
                    {i + 1}
                  </span>
                )}
                <span className="text-sm text-foreground truncate">{item.reason}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {item.count}
                </span>
                <span className="text-xs font-semibold tabular-nums text-foreground min-w-[55px] text-right">
                  {item.percentage.toFixed(1)}%
                </span>
              </div>
            </div>
            <div className="h-1.5 rounded-full bg-muted/60 overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-volt to-aqua transition-all duration-500"
                style={{ width: `${item.percentage}%` }}
              />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
