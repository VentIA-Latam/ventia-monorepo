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

  return (
    <div className="flex items-center gap-3 rounded-md bg-muted/30 px-3 py-2.5">
      <div className="flex items-center justify-center h-10 w-10 rounded-full bg-green-100 dark:bg-green-950 shrink-0">
        <User className="h-5 w-5 text-green-600 dark:text-green-400" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{name}</p>
        {phone ? (
          <div className="flex items-center gap-1 mt-0.5">
            <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">{phone}</span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
