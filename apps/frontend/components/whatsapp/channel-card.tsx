"use client";

import { FileText, RefreshCw } from "lucide-react";
import type { WhatsAppChannel } from "@/lib/types/messaging";

function formatRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "Nunca";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `Hace ${diffMin}m`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `Hace ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Hace ${diffD}d`;
}

export function ChannelCard({ channel }: { channel: WhatsAppChannel }) {
  const isHealthy = !channel.reauthorization_required;

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-5">
      {/* Header: status + phone + badge */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-full ${
              isHealthy ? "bg-green-50" : "bg-warning-bg"
            }`}
          >
            <span
              className={`h-3 w-3 rounded-full ${
                isHealthy ? "bg-[#25D366]" : "bg-warning"
              }`}
            />
          </div>
          <div>
            <p className="text-[15px] font-semibold text-foreground">
              {channel.phone_number}
            </p>
            <p className="text-xs text-muted-foreground">
              {channel.inbox_name}
            </p>
          </div>
        </div>
        <span
          className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold ${
            isHealthy
              ? "bg-green-50 text-green-700"
              : "bg-warning-bg text-warning"
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              isHealthy ? "bg-[#25D366]" : "bg-warning"
            }`}
          />
          {isHealthy ? "Conectado" : "Reautorizar"}
        </span>
      </div>

      {/* Separator */}
      <div className="h-px bg-border" />

      {/* Stats */}
      <div className="flex justify-around">
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-lg font-bold text-foreground">
              {channel.templates_count}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">Plantillas</span>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-1.5">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground" />
            <span
              className={`text-sm font-semibold ${
                isHealthy ? "text-foreground" : "text-warning"
              }`}
            >
              {formatRelativeTime(channel.last_template_sync)}
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground">
            Ultimo sync
          </span>
        </div>
      </div>
    </div>
  );
}
