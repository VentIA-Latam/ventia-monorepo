"use client";

import { memo, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { Trash2 } from "lucide-react";
import type { Conversation } from "@/lib/types/messaging";

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: (id: string) => void;
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

function parseTimestamp(value: string | number | null): Date | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isNaN(num) && num > 1_000_000_000 && num < 10_000_000_000) {
    return new Date(num * 1000);
  }
  if (!Number.isNaN(num) && num > 1_000_000_000_000) {
    return new Date(num);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function getWhatsAppTime(dateStr: string | number | null): string {
  const date = parseTimestamp(dateStr);
  if (!date) return "";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) {
    return date.toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
  }
  if (msgDay.getTime() === yesterday.getTime()) {
    return "Ayer";
  }
  return date.toLocaleDateString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  onClick,
  onDelete,
}: ConversationItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const contact = conversation.contact;

  return (
    <>
      <div
        className={cn(
          "group w-full flex items-center gap-3 py-3 px-4 text-left transition-colors cursor-pointer border-b border-border/30",
          isSelected
            ? "bg-primary/10 border-l-4 border-l-primary"
            : "hover:bg-muted/30"
        )}
        onClick={onClick}
      >
        <Avatar className="h-12 w-12 shrink-0">
          <AvatarFallback className="text-sm font-medium bg-muted">
            {getInitials(contact?.name)}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[15px] font-medium truncate">
              {contact?.name || contact?.phone_number || "Sin nombre"}
            </p>
            <span className="text-xs text-muted-foreground shrink-0">
              {getWhatsAppTime(conversation.last_message_at)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <p className="text-[13px] text-muted-foreground truncate">
              {contact?.phone_number || contact?.email || ""}
            </p>
          </div>
        </div>

        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
            onClick={(e) => {
              e.stopPropagation();
              setShowDeleteDialog(true);
            }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Eliminar conversación</AlertDialogTitle>
            <AlertDialogDescription>
              ¿Estás seguro de que deseas eliminar esta conversación? Se eliminarán todos los mensajes asociados. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className={cn(buttonVariants({ variant: "destructive" }))}
              onClick={() => onDelete?.(conversation.id)}
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
});
