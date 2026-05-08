"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { FileDown, Check, CheckCheck, AlertCircle, X, Download, ExternalLink, Bot } from "lucide-react";
import type { MessageStatus } from "@/lib/types/messaging";
import { LocationBubble } from "./location-bubble";
import { ContactBubble } from "./contact-bubble";
import type { Message, AttachmentBrief, CtaUrlData, ReferralData } from "@/lib/types/messaging";
import { ReferralBubble } from "./referral-bubble";
import { formatTime, getSenderRole, getInitials } from "@/lib/utils/messaging";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import dynamic from "next/dynamic";

const AudioPlayer = dynamic(
  () => import("./audio-player").then((mod) => ({ default: mod.AudioPlayer })),
  {
    ssr: false,
    loading: () => <div className="h-8 w-[220px] bg-muted/30 rounded animate-pulse" />,
  }
);

function getAttUrl(att: AttachmentBrief): string {
  return att.file_url || att.data_url || "";
}

function formatFileSize(bytes: number | null | undefined): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/* ── Image Lightbox ── */
function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Toolbar */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-[101]">
        <a
          href={src}
          download
          onClick={(e) => e.stopPropagation()}
          className="rounded-full bg-white/10 hover:bg-white/20 p-2 transition-colors"
          title="Descargar"
        >
          <Download className="h-5 w-5 text-white" />
        </a>
        <button
          onClick={onClose}
          className="rounded-full bg-white/10 hover:bg-white/20 p-2 transition-colors"
          title="Cerrar"
        >
          <X className="h-5 w-5 text-white" />
        </button>
      </div>

      {/* Image */}
      <img
        src={src}
        alt={alt}
        className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
    </div>,
    document.body
  );
}

/* ── CTA URL Button — WhatsApp-style separated action ── */
function CtaUrlBubble({ cta, isOutgoing }: { cta: CtaUrlData; isOutgoing: boolean }) {
  return (
    <div className="-mx-3 -mb-1.5 mt-2">
      {/* Divider — full-width separator like WhatsApp native CTA */}
      <div className={cn(
        "h-px",
        isOutgoing ? "bg-marino/10" : "bg-border/50"
      )} />
      {/* Action button */}
      <a
        href={cta.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold",
          "transition-colors cursor-pointer",
          isOutgoing
            ? "text-volt hover:bg-marino/5"
            : "text-volt hover:bg-muted/40"
        )}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {cta.display_text}
      </a>
    </div>
  );
}

function StatusIcon({ status }: { status?: MessageStatus }) {
  switch (status) {
    case "sent":
      return <Check className="h-[14px] w-[14px] text-muted-foreground/60" />;
    case "read":
      return <CheckCheck className="h-[14px] w-[14px] text-primary" />;
    case "failed":
      return <AlertCircle className="h-[14px] w-[14px] text-destructive" />;
    case "delivered":
    default:
      return <CheckCheck className="h-[14px] w-[14px] text-muted-foreground/60" />;
  }
}

interface MessageBubbleProps {
  message: Message;
  showAvatar?: boolean;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  showAvatar = true,
}: MessageBubbleProps) {
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const closeLightbox = useCallback(() => setLightboxSrc(null), []);

  const isOutgoing = message.message_type === "outgoing" || message.message_type === "template";
  const isActivity = message.message_type === "activity";

  if (isActivity) {
    return (
      <div className="flex justify-center py-1">
        <p className="text-[12px] text-muted-foreground bg-card/80 shadow-sm px-3 py-1.5 rounded-lg">
          {message.content}
        </p>
      </div>
    );
  }

  const time = formatTime(message.created_at);
  const isUnavailable = !isOutgoing && message.content_attributes?.is_unavailable === true;

  if (isUnavailable) {
    return (
      <div className="flex max-w-[min(65%,500px)] mr-auto">
        <div className="relative rounded-lg rounded-tl-[4px] px-3 py-2 text-sm shadow-sm bg-card/60 border border-dashed border-border/60 min-w-0">
          {message.content_attributes?.referral ? (
            <ReferralBubble referral={message.content_attributes.referral} />
          ) : null}

          <div className="flex items-center gap-2 text-muted-foreground italic">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[13px]">
              Mensaje no disponible
              <span className="inline-block w-[70px]" />
            </span>
          </div>

          <span className="absolute bottom-1 right-2 text-[11px] text-muted-foreground/50">
            {time}
          </span>
        </div>
      </div>
    );
  }

  const hasReferral = !isOutgoing && !!message.content_attributes?.referral;
  const senderRole = getSenderRole(message);
  const operatorName =
    message.sender && "name" in message.sender ? message.sender.name : null;
  const avatarTooltip =
    senderRole === "ai"
      ? "Enviado por: IA"
      : `Enviado por: ${operatorName ?? "operador"}`;

  return (
    <div
      className={cn(
        "relative flex max-w-[min(65%,500px)]",
        isOutgoing ? "ml-auto justify-end" : "mr-auto"
      )}
    >
      <div
        className={cn(
          "relative rounded-lg px-3 py-1.5 text-sm shadow-sm overflow-hidden min-w-0",
          hasReferral && "w-[280px]",
          isOutgoing
            ? "bg-chat-outgoing rounded-tr-[4px]"
            : "bg-card rounded-tl-[4px]"
        )}
      >
        {/* Referral preview for incoming messages from ads */}
        {!isOutgoing && message.content_attributes?.referral ? (
          <ReferralBubble referral={message.content_attributes.referral} />
        ) : null}

        {/* Sender name for incoming */}
        {!isOutgoing && message.sender && "name" in message.sender && (
          <p className="text-xs font-medium text-primary/80 mb-0.5">
            {message.sender.name}
          </p>
        )}

        {/* Content — hide if message has contact attachment */}
        {message.content && !message.attachments?.some(a => a.file_type === "contact") ? (
          <p className="whitespace-pre-wrap break-words" style={{ overflowWrap: "anywhere" }}>
            {message.content}
            {/* Invisible spacer so time+check don't overlap text (skip for CTA — has flow timestamp) */}
            {!message.content_attributes?.cta_url && <span className="inline-block w-[70px]" />}
          </p>
        ) : null}

        {/* CTA: timestamp above the divider, then the action button below */}
        {message.content_attributes?.cta_url && (
          <>
            <div
              className={cn(
                "flex items-center justify-end gap-0.5 text-[11px] mt-1",
                isOutgoing ? "text-muted-foreground/60" : "text-muted-foreground/50"
              )}
            >
              {time}
              {isOutgoing && <StatusIcon status={message.status} />}
            </div>
            <CtaUrlBubble cta={message.content_attributes.cta_url} isOutgoing={isOutgoing} />
          </>
        )}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-1.5 space-y-1.5">
            {message.attachments.map((att) => {
              if (att.file_type === "image") {
                const imgUrl = getAttUrl(att);
                return (
                  <img
                    key={att.id}
                    src={imgUrl}
                    alt={att.filename || "Imagen"}
                    className="rounded-md max-w-full max-h-64 object-cover cursor-pointer hover:opacity-90 transition-opacity"
                    style={{ minHeight: "100px", minWidth: "100px" }}
                    onClick={() => setLightboxSrc(imgUrl)}
                  />
                );
              }

              if (att.file_type === "audio") {
                return (
                  <AudioPlayer
                    key={att.id}
                    src={getAttUrl(att)}
                    isOutgoing={isOutgoing}
                  />
                );
              }

              if (att.file_type === "video") {
                return (
                  <video
                    key={att.id}
                    controls
                    src={getAttUrl(att)}
                    className="rounded-md w-full max-h-64"
                  />
                );
              }

              if (att.file_type === "location") {
                return <LocationBubble key={att.id} attachment={att} />;
              }

              if (att.file_type === "contact") {
                return <ContactBubble key={att.id} attachment={att} isOutgoing={isOutgoing} />;
              }

              // Generic file download
              return (
                <a
                  key={att.id}
                  href={getAttUrl(att) || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2"
                >
                  <FileDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm truncate">{att.filename || "Archivo adjunto"}</p>
                    {att.file_size ? (
                      <p className="text-xs text-muted-foreground">{formatFileSize(att.file_size)}</p>
                    ) : null}
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* Timestamp + checkmarks (skip for CTA — already rendered above the button) */}
        {message.content_attributes?.cta_url ? null : (message.attachments && message.attachments.length > 0) ? (
          /* Flow-based timestamp below attachments (Chatwoot pattern) */
          <div
            className={cn(
              "flex items-center justify-end gap-0.5 text-[11px] mt-1",
              isOutgoing ? "text-muted-foreground/60" : "text-muted-foreground/50"
            )}
          >
            {time}
            {isOutgoing && <StatusIcon status={message.status} />}
          </div>
        ) : (
          /* Absolute timestamp for text-only messages (WhatsApp style with spacer) */
          <span
            className={cn(
              "absolute bottom-1 right-2 flex items-center gap-0.5 text-[11px]",
              isOutgoing ? "text-muted-foreground/60" : "text-muted-foreground/50"
            )}
          >
            {time}
            {isOutgoing && <StatusIcon status={message.status} />}
          </span>
        )}
      </div>

      {/* Image Lightbox */}
      {lightboxSrc && (
        <ImageLightbox
          src={lightboxSrc}
          alt="Imagen ampliada"
          onClose={closeLightbox}
        />
      )}

      {isOutgoing && message.content_attributes?.automated && (
        <span className="block w-full text-[10px] text-muted-foreground/70 mt-0.5 text-right pr-1 italic">
          Mensaje automático
        </span>
      )}

      {/* Avatar lateral en outgoing — absolute para no robarle ancho al bubble */}
      {isOutgoing && showAvatar && (
        <Tooltip delayDuration={150}>
          <TooltipTrigger asChild>
            <div
              aria-label={avatarTooltip}
              className={cn(
                "absolute bottom-0 -right-7 flex h-6 w-6 cursor-default items-center justify-center rounded-full text-[9px] font-bold transition-opacity duration-150 hover:opacity-90",
                senderRole === "ai"
                  ? "bg-success-bg text-success border border-success/30"
                  : "bg-cielo text-marino dark:bg-info-bg dark:text-info dark:border dark:border-info/30"
              )}
            >
              {senderRole === "ai" ? (
                <Bot className="h-3 w-3" strokeWidth={2.5} />
              ) : (
                getInitials(operatorName)
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="left" sideOffset={4}>
            {avatarTooltip}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
});
