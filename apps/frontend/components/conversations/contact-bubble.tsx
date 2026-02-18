"use client";

import { User } from "lucide-react";
import type { AttachmentBrief } from "@/lib/types/messaging";

interface ContactBubbleProps {
  attachment: AttachmentBrief;
}

export function ContactBubble({ attachment }: ContactBubbleProps) {
  const meta = attachment.meta;
  const firstName = (meta?.firstName as string) ?? (meta?.first_name as string) ?? "";
  const lastName = (meta?.lastName as string) ?? (meta?.last_name as string) ?? "";
  const name = [firstName, lastName].filter(Boolean).join(" ") || "Contacto";

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2">
      <div className="flex items-center justify-center h-8 w-8 rounded-full bg-muted shrink-0">
        <User className="h-4 w-4 text-muted-foreground" />
      </div>
      <span className="text-sm font-medium truncate">{name}</span>
    </div>
  );
}
