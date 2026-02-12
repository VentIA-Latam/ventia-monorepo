"use client";

import { memo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/lib/types/messaging";

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
}

function getInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getRelativeTime(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHr < 24) return `${diffHr}h`;
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "short" });
}

const statusConfig: Record<string, { label: string; className: string }> = {
  open: { label: "Abierta", className: "bg-success-bg text-success border-success/30" },
  pending: { label: "Pendiente", className: "bg-warning-bg text-warning border-warning/30" },
  resolved: { label: "Resuelta", className: "bg-muted/50 text-foreground border-border" },
};

export const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: ConversationItemProps) {
  const contact = conversation.contact;
  const config = statusConfig[conversation.status] ?? statusConfig.open;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-3 rounded-lg text-left transition-colors",
        isSelected
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted/50"
      )}
    >
      <Avatar className="h-10 w-10 shrink-0">
        <AvatarFallback className="text-xs font-medium">
          {getInitials(contact?.name)}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-medium truncate">
            {contact?.name || contact?.phone_number || "Sin nombre"}
          </p>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {getRelativeTime(conversation.last_message_at)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-xs text-muted-foreground truncate">
            {contact?.phone_number || contact?.email || ""}
          </p>
          <Badge variant="outline" className={cn("text-[10px] shrink-0", config.className)}>
            {config.label}
          </Badge>
        </div>
      </div>
    </button>
  );
});
