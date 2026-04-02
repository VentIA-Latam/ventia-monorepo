"use client";

import { User, Phone } from "lucide-react";
import type { AttachmentBrief } from "@/lib/types/messaging";

interface ContactBubbleProps {
  attachment: AttachmentBrief;
}

export function ContactBubble({ attachment }: ContactBubbleProps) {
  const meta = attachment.meta;
  const firstName = (meta?.firstName as string) ?? (meta?.first_name as string) ?? "";
  const lastName = (meta?.lastName as string) ?? (meta?.last_name as string) ?? "";
  const phone = (meta?.phone as string) ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ") || "Contacto";
  const hasName = name !== "Contacto";
  const initials = hasName
    ? name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "";

  return (
    <div className="w-[220px] rounded-lg overflow-hidden bg-background/60 border border-border/30">
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Avatar — plain muted color with initials (matching Pencil mockup) */}
        {hasName ? (
          <div className="flex items-center justify-center h-10 w-10 rounded-full bg-emerald-50 dark:bg-emerald-950 shrink-0">
            <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">{initials}</span>
          </div>
        ) : (
          <div className="flex items-center justify-center h-9 w-9 rounded-full bg-muted shrink-0">
            <User className="h-[18px] w-[18px] text-muted-foreground" />
          </div>
        )}

        {/* Name + phone */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate leading-tight">{name}</p>
          {phone ? (
            <div className="flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">{phone}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
