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
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="w-[220px] rounded-lg overflow-hidden border border-border/40">
      {/* Contact card header */}
      <div className="flex items-center gap-3 px-3 py-3 bg-muted/20">
        <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-emerald-400 to-teal-500 shrink-0 shadow-sm">
          {initials !== "C" ? (
            <span className="text-sm font-semibold text-white">{initials}</span>
          ) : (
            <User className="h-5 w-5 text-white" />
          )}
        </div>
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
