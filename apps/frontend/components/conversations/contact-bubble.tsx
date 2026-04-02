"use client";

import { User, Phone } from "lucide-react";
import type { AttachmentBrief } from "@/lib/types/messaging";

interface ContactBubbleProps {
  attachment: AttachmentBrief;
  isOutgoing?: boolean;
}

export function ContactBubble({ attachment, isOutgoing = false }: ContactBubbleProps) {
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
    <div className={`w-[220px] rounded-lg overflow-hidden border border-border/30 ${isOutgoing ? "bg-white dark:bg-card" : "bg-muted/30"}`}>
      <div className="flex items-center gap-3 px-3 py-2.5">
        {/* Avatar — outgoing: blue muted, incoming: green muted */}
        {hasName ? (
          <div className={`flex items-center justify-center h-10 w-10 rounded-full shrink-0 ${
            isOutgoing
              ? "bg-blue-100 dark:bg-blue-950"
              : "bg-green-100 dark:bg-green-950"
          }`}>
            <span className={`text-sm font-semibold ${
              isOutgoing
                ? "text-blue-800 dark:text-blue-300"
                : "text-green-800 dark:text-green-300"
            }`}>{initials}</span>
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
