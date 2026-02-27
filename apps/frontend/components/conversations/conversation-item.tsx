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
import {
  Trash2,
  Snowflake,
  Thermometer,
  Flame,
  Check,
  Image,
  Mic,
  Video,
  FileText,
  MapPin,
  Paperclip,
} from "lucide-react";
import type { Conversation } from "@/lib/types/messaging";
import { getInitials, getWhatsAppTime } from "@/lib/utils/messaging";

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  onClick: () => void;
  onDelete?: (id: number) => void;
}

const ATTACHMENT_ICONS: Record<string, { icon: typeof Image; label: string }> = {
  image: { icon: Image, label: "Foto" },
  audio: { icon: Mic, label: "Audio" },
  video: { icon: Video, label: "Video" },
  file: { icon: FileText, label: "Archivo" },
  document: { icon: FileText, label: "Documento" },
  location: { icon: MapPin, label: "Ubicación" },
};

function getMessagePreview(conversation: Conversation): React.ReactNode {
  const { last_message, contact } = conversation;

  if (!last_message) {
    return contact?.phone_number || contact?.email || "";
  }

  // Attachment message
  if (last_message.attachment_type) {
    const attachment = ATTACHMENT_ICONS[last_message.attachment_type] || {
      icon: Paperclip,
      label: "Adjunto",
    };
    const AttachmentIcon = attachment.icon;
    return (
      <span className="inline-flex items-center gap-1">
        {last_message.message_type === "outgoing" && (
          <Check className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <AttachmentIcon className="h-3 w-3 shrink-0" />
        <span>{attachment.label}</span>
      </span>
    );
  }

  // Text message
  if (last_message.content) {
    return (
      <span className="inline-flex items-center gap-1 min-w-0">
        {last_message.message_type === "outgoing" && (
          <Check className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="truncate">{last_message.content}</span>
      </span>
    );
  }

  return contact?.phone_number || contact?.email || "";
}

export const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  onClick,
  onDelete,
}: ConversationItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const contact = conversation.contact;
  const unreadCount = conversation.unread_count ?? 0;
  const hasUnread = unreadCount > 0;

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
            <p
              className={cn(
                "text-[15px] truncate",
                hasUnread ? "font-semibold" : "font-medium"
              )}
            >
              {contact?.name || contact?.phone_number || "Sin nombre"}
            </p>
            <span
              suppressHydrationWarning
              className={cn(
                "text-xs shrink-0",
                hasUnread ? "text-primary font-medium" : "text-muted-foreground"
              )}
            >
              {getWhatsAppTime(conversation.last_message_at)}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <p
                className={cn(
                  "text-[13px] truncate",
                  hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
                )}
              >
                {getMessagePreview(conversation)}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Temperature icon */}
              {conversation.temperature === "cold" && <Snowflake className="h-3 w-3 text-blue-500" />}
              {conversation.temperature === "warm" && <Thermometer className="h-3 w-3 text-orange-500" />}
              {conversation.temperature === "hot" && <Flame className="h-3 w-3 text-red-500" />}
              {/* Unread badge */}
              {hasUnread && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-semibold leading-none">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>
          </div>
          {/* Label badges */}
          {conversation.labels && conversation.labels.length > 0 && (
            <div className="flex items-center gap-1 mt-1 overflow-hidden">
              {conversation.labels.slice(0, 2).map((label) => (
                <span
                  key={label.id}
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium leading-none max-w-[120px] truncate"
                  style={{
                    backgroundColor: `${label.color}18`,
                    color: label.color,
                    border: `1px solid ${label.color}30`,
                  }}
                >
                  <span
                    className="h-1.5 w-1.5 rounded-sm shrink-0"
                    style={{ backgroundColor: label.color }}
                  />
                  {label.title}
                </span>
              ))}
              {conversation.labels.length > 2 && (
                <span className="text-[10px] text-muted-foreground font-medium">
                  +{conversation.labels.length - 2}
                </span>
              )}
            </div>
          )}
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
