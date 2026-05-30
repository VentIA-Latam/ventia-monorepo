"use client";

import { AlertTriangle, AtSign } from "lucide-react";
import { FaInstagram } from "react-icons/fa6";
import type { InstagramChannel } from "@/lib/types/messaging";

export function ChannelCard({ channel }: { channel: InstagramChannel }) {
  const isHealthy = !channel.reauthorization_required;
  const handle = channel.username ? `@${channel.username}` : channel.instagram_id;

  return (
    <div className="group relative flex flex-col rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
      <div className={`h-1 rounded-t-xl ${isHealthy ? "bg-gradient-to-r from-[#feda75] via-[#d62976] to-[#962fbf]" : "bg-warning"}`} />

      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${isHealthy ? "bg-gradient-to-br from-[#feda75] via-[#d62976] to-[#962fbf]" : "bg-warning"}`}>
              <FaInstagram className="h-6 w-6 text-white" />
            </div>
            <div>
              <p className="text-base font-semibold text-foreground">{handle}</p>
              <p className="text-xs text-muted-foreground">{channel.inbox_name}</p>
            </div>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
              isHealthy ? "bg-[#d62976]/10 text-[#d62976]" : "bg-warning-bg text-warning"
            }`}
          >
            {isHealthy ? (
              <span className="h-1.5 w-1.5 rounded-full bg-[#d62976] animate-pulse" />
            ) : (
              <AlertTriangle className="h-3 w-3" />
            )}
            {isHealthy ? "Conectado" : "Reautorizar"}
          </span>
        </div>

        <div className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
          <AtSign className="h-4 w-4 text-muted-foreground" />
          <div>
            <p className="text-sm font-semibold text-foreground">{handle}</p>
            <p className="text-[10px] text-muted-foreground">Cuenta de Instagram</p>
          </div>
        </div>
      </div>
    </div>
  );
}
