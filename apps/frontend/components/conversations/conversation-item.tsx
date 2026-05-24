"use client";

import { memo, useCallback, useState } from "react";
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import {
  Trash2,
  Thermometer,
  Check,
  CheckCheck,
  AlertCircle,
  Image,
  Mic,
  Video,
  FileText,
  MapPin,
  Paperclip,
  User,
  Bot,
  MoreVertical,
  TrendingUp,
  Headset,
} from "lucide-react";
import { TEMPERATURE_ICON_MAP } from "@/lib/utils/temperature-icons";
import type { Conversation, TemperatureDefinition, MessageStatus } from "@/lib/types/messaging";
import { getInitials, getWhatsAppTime } from "@/lib/utils/messaging";
import { formatWhatsAppText } from "@/lib/utils/whatsapp-format";
import {
  updateConversationStage,
  escalateConversation,
  resolveEscalationConversation,
} from "@/lib/api-client/messaging";

interface ConversationItemProps {
  conversation: Conversation;
  isSelected: boolean;
  temperatureConfig?: TemperatureDefinition[];
  tenantId?: number;
  onClick: () => void;
  onDelete?: (id: number) => void;
  searchQuery?: string;
  isSelectMode?: boolean;
  isChecked?: boolean;
  onToggleSelect?: (id: number) => void;
}

function ListStatusIcon({ status }: { status?: MessageStatus }) {
  switch (status) {
    case "sent":
      return <Check className="h-3 w-3 shrink-0 text-muted-foreground" />;
    case "read":
      return <CheckCheck className="h-3 w-3 shrink-0 text-primary" />;
    case "failed":
      return <AlertCircle className="h-3 w-3 shrink-0 text-destructive" />;
    case "delivered":
    default:
      return <CheckCheck className="h-3 w-3 shrink-0 text-muted-foreground" />;
  }
}

const ATTACHMENT_ICONS: Record<string, { icon: typeof Image; label: string }> = {
  image: { icon: Image, label: "Foto" },
  audio: { icon: Mic, label: "Audio" },
  video: { icon: Video, label: "Video" },
  file: { icon: FileText, label: "Archivo" },
  document: { icon: FileText, label: "Documento" },
  location: { icon: MapPin, label: "Ubicación" },
  contact: { icon: User, label: "Contacto" },
};

function getMessagePreview(conversation: Conversation): React.ReactNode {
  const { last_message, contact } = conversation;

  if (!last_message) {
    return contact?.phone_number || contact?.whatsapp_bsuid || contact?.email || "";
  }

  // Attachment message
  if (last_message.attachment_type) {
    const attachment = ATTACHMENT_ICONS[last_message.attachment_type] || {
      icon: Paperclip,
      label: "Adjunto",
    };
    const AttachmentIcon = attachment.icon;
    // For contacts, show the contact name from content (like WhatsApp)
    const displayLabel = last_message.attachment_type === "contact" && last_message.content
      ? last_message.content
      : attachment.label;
    return (
      <span className="inline-flex items-center gap-1">
        {last_message.message_type === "outgoing" && (
          <ListStatusIcon status={last_message.status} />
        )}
        <AttachmentIcon className="h-3 w-3 shrink-0" />
        <span className="truncate">{displayLabel}</span>
      </span>
    );
  }

  // Text message
  if (last_message.content) {
    return (
      <span className="inline-flex items-center gap-1 min-w-0">
        {last_message.message_type === "outgoing" && (
          <ListStatusIcon status={last_message.status} />
        )}
        <span className="truncate">{formatWhatsAppText(last_message.content)}</span>
      </span>
    );
  }

  return contact?.phone_number || contact?.whatsapp_bsuid || contact?.email || "";
}

export const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  temperatureConfig = [],
  tenantId,
  onClick,
  onDelete,
  searchQuery,
  isSelectMode = false,
  isChecked = false,
  onToggleSelect,
}: ConversationItemProps) {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const contact = conversation.contact;

  const isPreSale = conversation.stage === "pre_sale";
  const newStage = isPreSale ? "sale" : "pre_sale";
  const stageLabel = isPreSale ? "Mover a Venta" : "Mover a Pre-venta";

  const handleChangeStage = useCallback(async () => {
    try {
      await updateConversationStage(conversation.id, newStage, tenantId);
    } catch (err) {
      console.error("Error changing stage:", err);
    }
  }, [conversation.id, newStage, tenantId]);

  const handleEscalate = useCallback(async () => {
    try {
      await escalateConversation(conversation.id, tenantId);
    } catch (err) {
      console.error("Error escalating conversation:", err);
    }
  }, [conversation.id, tenantId]);

  const handleResolveEscalation = useCallback(async () => {
    try {
      await resolveEscalationConversation(conversation.id, tenantId);
    } catch (err) {
      console.error("Error resolving escalation:", err);
    }
  }, [conversation.id, tenantId]);

  const handleDeleteClick = useCallback(() => {
    setShowDeleteDialog(true);
  }, []);
  const unreadCount = conversation.unread_count ?? 0;
  const hasUnread = unreadCount > 0;

  return (
    <>
      <ContextMenu>
        <ContextMenuTrigger asChild>
      <div
        className={cn(
          "group w-full flex items-center gap-3 py-3 px-4 text-left transition-colors cursor-pointer border-b border-border/30",
          isSelectMode && isChecked
            ? "bg-primary/10"
            : isSelected && !isSelectMode
              ? "bg-primary/10 border-l-4 border-l-primary"
              : "hover:bg-muted/30"
        )}
        onClick={isSelectMode ? () => onToggleSelect?.(conversation.id) : onClick}
      >
        <div className="relative shrink-0 flex items-center justify-center">
          {isSelectMode ? (
            <div className="h-12 w-12 flex items-center justify-center">
              <Checkbox
                checked={isChecked}
                onCheckedChange={() => onToggleSelect?.(conversation.id)}
                onClick={(e) => e.stopPropagation()}
                className="h-5 w-5"
                aria-label="Seleccionar conversación"
              />
            </div>
          ) : (
            <>
              <Avatar className="h-12 w-12">
                <AvatarFallback className="text-sm font-medium bg-muted">
                  {getInitials(contact?.name)}
                </AvatarFallback>
              </Avatar>
              <span
                aria-label={
                  conversation.ai_agent_enabled
                    ? "Agente IA activo"
                    : "Agente IA pausado"
                }
                title={
                  conversation.ai_agent_enabled
                    ? "Agente IA activo"
                    : "Agente IA pausado"
                }
                className={cn(
                  "absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background transition-colors",
                  conversation.ai_agent_enabled
                    ? "bg-success text-background shadow-[0_0_6px_-1px_oklch(0.59_0.18_145/0.5)]"
                    : "bg-muted text-muted-foreground"
                )}
              >
                <Bot className="h-3 w-3" strokeWidth={2.5} />
              </span>
            </>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <p
                className={cn(
                  "text-[15px] truncate",
                  hasUnread ? "font-semibold" : "font-medium"
                )}
              >
                {contact?.name || contact?.phone_number || contact?.whatsapp_bsuid || "Sin nombre"}
              </p>
              {conversation.stage === "sale" && (
                <span className="inline-flex items-center shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none bg-success-bg text-success border border-success/30">
                  Venta
                </span>
              )}
            </div>
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
              {searchQuery && conversation.message_snippet ? (
                <p
                  className="text-[13px] text-muted-foreground truncate [&_mark]:bg-volt/30 [&_mark]:text-foreground [&_mark]:rounded-[2px] [&_mark]:px-px"
                  dangerouslySetInnerHTML={{ __html: conversation.message_snippet }}
                />
              ) : (
                <p
                  className={cn(
                    "text-[13px] truncate",
                    hasUnread ? "text-foreground font-medium" : "text-muted-foreground"
                  )}
                >
                  {getMessagePreview(conversation)}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* Temperature icon */}
              {conversation.temperature && (() => {
                const tempDef = temperatureConfig.find((t) => t.key === conversation.temperature);
                if (!tempDef) return null;
                const TempIcon = TEMPERATURE_ICON_MAP[tempDef.icon] ?? Thermometer;
                return <TempIcon className="h-3 w-3" style={{ color: tempDef.color }} />;
              })()}
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

        {!isSelectMode && <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Más acciones"
              className="h-8 w-8 shrink-0 text-muted-foreground transition-opacity opacity-100 [@media(hover:hover)]:md:opacity-0 [@media(hover:hover)]:md:group-hover:opacity-100 data-[state=open]:opacity-100"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            onClick={(e) => e.stopPropagation()}
          >
            <DropdownMenuItem onSelect={handleChangeStage}>
              <TrendingUp className="h-4 w-4 mr-2" />
              {stageLabel}
            </DropdownMenuItem>
            {conversation.ai_agent_enabled ? (
              <DropdownMenuItem onSelect={handleEscalate}>
                <Headset className="h-4 w-4 mr-2" />
                Escalar
              </DropdownMenuItem>
            ) : (
              <DropdownMenuItem
                onSelect={handleResolveEscalation}
                className="text-success focus:text-success focus:bg-success-bg"
              >
                <Bot className="h-4 w-4 mr-2" />
                Activar agente IA
              </DropdownMenuItem>
            )}
            {onDelete && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={handleDeleteClick}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar conversación
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>}
      </div>
        </ContextMenuTrigger>
        {!isSelectMode && <ContextMenuContent>
          <ContextMenuItem onSelect={handleChangeStage}>
            <TrendingUp className="h-4 w-4 mr-2" />
            {stageLabel}
          </ContextMenuItem>
          {conversation.ai_agent_enabled ? (
            <ContextMenuItem onSelect={handleEscalate}>
              <Headset className="h-4 w-4 mr-2" />
              Escalar
            </ContextMenuItem>
          ) : (
            <ContextMenuItem
              onSelect={handleResolveEscalation}
              className="text-success focus:text-success focus:bg-success-bg"
            >
              <Bot className="h-4 w-4 mr-2" />
              Activar agente IA
            </ContextMenuItem>
          )}
          {onDelete && (
            <>
              <ContextMenuSeparator />
              <ContextMenuItem variant="destructive" onSelect={handleDeleteClick}>
                <Trash2 className="h-4 w-4 mr-2" />
                Eliminar conversación
              </ContextMenuItem>
            </>
          )}
        </ContextMenuContent>}
      </ContextMenu>

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
