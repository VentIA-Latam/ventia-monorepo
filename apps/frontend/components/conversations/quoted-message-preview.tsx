"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { X, ImageIcon, Video, Mic, FileText, MapPin, User, Reply, Smile } from "lucide-react";
import type { Message } from "@/lib/types/messaging";

/** Etiqueta del remitente del mensaje citado (estilo WhatsApp: "Tú" o el nombre del contacto). */
function getQuoteSenderLabel(message: Message): string {
  if (message.message_type === "incoming") {
    return message.sender && "name" in message.sender && message.sender.name
      ? message.sender.name
      : "Cliente";
  }
  return "Tú";
}

/** Preview compacto del contenido citado: texto truncado o ícono + tipo de adjunto. */
function getQuotePreview(message: Message): { icon: typeof ImageIcon | null; label: string } {
  const text = message.content?.trim();
  if (text) return { icon: null, label: text };

  const att = message.attachments?.[0];
  switch (att?.file_type) {
    case "image":
      return { icon: ImageIcon, label: "Foto" };
    case "video":
      return { icon: Video, label: "Video" };
    case "audio":
      return { icon: Mic, label: "Audio" };
    case "sticker":
      return { icon: Smile, label: "Sticker" };
    case "location":
      return { icon: MapPin, label: "Ubicación" };
    case "contact":
      return { icon: User, label: "Contacto" };
    case "file":
      return { icon: FileText, label: att.filename || "Documento" };
    default:
      break;
  }

  if (message.content_attributes?.cards?.length) {
    return { icon: ImageIcon, label: "Carrusel" };
  }
  return { icon: null, label: "Mensaje" };
}

interface QuotedMessagePreviewProps {
  message?: Message | null;
  variant: "composer" | "bubble";
  /** Estilo del bubble contenedor (afecta colores). Solo aplica a variant="bubble". */
  isOutgoing?: boolean;
  /** Cancelar el reply en curso (variant="composer"). */
  onCancel?: () => void;
  /** Saltar al mensaje original (variant="bubble"). */
  onClick?: () => void;
  /** Texto cuando el mensaje citado no está cargado en la ventana actual. */
  fallbackLabel?: string;
}

export const QuotedMessagePreview = memo(function QuotedMessagePreview({
  message,
  variant,
  isOutgoing = false,
  onCancel,
  onClick,
  fallbackLabel = "Mensaje original",
}: QuotedMessagePreviewProps) {
  const senderLabel = message ? getQuoteSenderLabel(message) : "";
  const preview = message ? getQuotePreview(message) : { icon: Reply, label: fallbackLabel };
  const PreviewIcon = preview.icon;

  if (variant === "composer") {
    return (
      <div data-testid="composer-reply-preview" className="mb-2 flex items-stretch gap-2 rounded-lg bg-card px-3 py-2 shadow-sm">
        <div className="w-1 shrink-0 rounded-full bg-volt" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium text-volt">{senderLabel}</p>
          <p className="flex items-center gap-1 truncate text-[13px] text-muted-foreground">
            {PreviewIcon ? <PreviewIcon className="h-3.5 w-3.5 shrink-0" /> : null}
            <span className="truncate">{preview.label}</span>
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar respuesta"
            className="shrink-0 self-start rounded-full p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  }

  // variant === "bubble"
  return (
    <button
      type="button"
      data-testid="bubble-quote"
      onClick={onClick}
      disabled={!message}
      className={cn(
        "mb-1.5 flex w-full items-stretch gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        message ? "cursor-pointer" : "cursor-default",
        isOutgoing ? "bg-marino/5 hover:bg-marino/10" : "bg-muted/50 hover:bg-muted/70"
      )}
    >
      <div className="w-1 shrink-0 rounded-full bg-volt" />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-volt">{senderLabel || fallbackLabel}</p>
        <p className="flex items-center gap-1 truncate text-[12px] text-muted-foreground">
          {PreviewIcon ? <PreviewIcon className="h-3 w-3 shrink-0" /> : null}
          <span className="truncate">{preview.label}</span>
        </p>
      </div>
    </button>
  );
});
