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
      <div
        data-testid="composer-reply-preview"
        className={cn(
          "mb-2 flex items-stretch gap-2 rounded-lg bg-card px-3 py-2 shadow-sm",
          // Animación de entrada — solo si el usuario no pidió reduced motion
          "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1 motion-safe:duration-150"
        )}
      >
        <div className="w-1 shrink-0 rounded-full bg-volt" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-semibold text-[var(--marino)]">{senderLabel}</p>
          {/* line-clamp-2 da más contexto que truncate de una sola línea
              cuando el original es multi-línea */}
          <p className="flex items-start gap-1 text-[13px] text-muted-foreground">
            {PreviewIcon ? <PreviewIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : null}
            <span className="line-clamp-2">{preview.label}</span>
          </p>
        </div>
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cancelar respuesta"
            title="Cancelar respuesta (Esc)"
            className="shrink-0 self-start rounded-full p-1 text-muted-foreground hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    );
  }

  // variant === "bubble"
  // Cuando `message` es null (snapshot no disponible — fue borrado o paginado fuera)
  // bajamos opacidad + tooltip explica por qué no es clickeable.
  const isUnavailable = !message;
  return (
    <button
      type="button"
      data-testid="bubble-quote"
      onClick={onClick}
      disabled={isUnavailable}
      title={isUnavailable ? "Mensaje original no disponible" : undefined}
      className={cn(
        "mb-1.5 flex w-full items-stretch gap-2 rounded-md px-2 py-1.5 text-left motion-safe:transition-colors touch-manipulation",
        isUnavailable ? "cursor-default opacity-70" : "cursor-pointer",
        isOutgoing ? "bg-marino/5 hover:bg-marino/10" : "bg-muted/50 hover:bg-muted/70",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40"
      )}
    >
      <div className="w-1 shrink-0 rounded-full bg-volt" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-[var(--marino)]">{senderLabel || fallbackLabel}</p>
        <p className="flex items-center gap-1 truncate text-[12px] text-muted-foreground">
          {PreviewIcon ? <PreviewIcon className="h-3 w-3 shrink-0" /> : null}
          <span className="truncate">{preview.label}</span>
        </p>
      </div>
    </button>
  );
});
