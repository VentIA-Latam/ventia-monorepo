"use client";

import { FileText, RefreshCw, AlertTriangle } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
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
    <div className="group relative flex flex-col rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
      {/* Top accent bar */}
      <div className={`h-1 rounded-t-xl ${isHealthy ? "bg-[#25D366]" : "bg-warning"}`} />

      <div className="flex flex-col gap-4 p-5">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isHealthy ? "bg-[#25D366]" : "bg-warning"}`}>
              <FaWhatsapp className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">
                {channel.phone_number}
              </p>
              <p className="text-xs text-muted-foreground">
                {channel.inbox_name}
              </p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              isHealthy
                ? "bg-[#25D366]/10 text-[#25D366]"
                : "bg-warning-bg text-warning"
            }`}
          >
            {isHealthy ? (
              <span className="h-1.5 w-1.5 rounded-full bg-[#25D366] animate-pulse" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {isHealthy ? "Conectado" : "Reautorizar"}
          </span>
        </div>

        {/* Stats */}
        <div className="flex gap-3">
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">{channel.templates_count}</p>
              <p className="text-[10px] text-muted-foreground">Plantillas</p>
            </div>
          </div>
          <div className="flex flex-1 items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <RefreshCw className={`h-4 w-4 ${isHealthy ? "text-muted-foreground" : "text-warning"}`} />
            <div>
              <p className={`text-sm font-semibold ${isHealthy ? "text-foreground" : "text-warning"}`}>
                {formatRelativeTime(channel.last_template_sync)}
              </p>
              <p className="text-[10px] text-muted-foreground">Ultimo sync</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
