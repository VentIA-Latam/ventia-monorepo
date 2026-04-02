"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { FileDown, CheckCheck, X, Download, ExternalLink } from "lucide-react";
import { LocationBubble } from "./location-bubble";
import { ContactBubble } from "./contact-bubble";
import type { Message, AttachmentBrief, CtaUrlData } from "@/lib/types/messaging";
import { formatTime } from "@/lib/utils/messaging";
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

/* ── CTA URL Button ── */
function CtaUrlBubble({ cta, isOutgoing }: { cta: CtaUrlData; isOutgoing: boolean }) {
  return (
    <div className="mt-1.5">
      <div className={cn(
        "border-t",
        isOutgoing ? "border-white/15" : "border-border/40"
      )} />
      <a
        href={cta.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "flex items-center justify-center gap-2 mt-1.5 px-4 py-2 rounded-md text-sm font-medium transition-colors",
          isOutgoing
            ? "bg-white/15 hover:bg-white/25 text-white"
            : "bg-primary/10 hover:bg-primary/20 text-primary"
        )}
      >
        <ExternalLink className="h-3.5 w-3.5" />
        {cta.display_text}
      </a>
    </div>
  );
}

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble = memo(function MessageBubble({
  message,
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

  return (
    <div
      className={cn(
        "flex max-w-[min(65%,500px)]",
        isOutgoing ? "ml-auto justify-end" : "mr-auto"
      )}
    >
      <div
        className={cn(
          "relative rounded-lg px-3 py-1.5 text-sm shadow-sm overflow-hidden",
          isOutgoing
            ? "bg-cielo rounded-tr-[4px]"
            : "bg-card rounded-tl-[4px]"
        )}
      >
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
            {/* Invisible spacer so time+check don't overlap text */}
            <span className="inline-block w-[70px]" />
          </p>
        ) : null}

        {/* CTA URL Button */}
        {message.content_attributes?.cta_url && (
          <CtaUrlBubble cta={message.content_attributes.cta_url} isOutgoing={isOutgoing} />
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

        {/* Timestamp + checkmarks */}
        {(message.attachments && message.attachments.length > 0) || message.content_attributes?.cta_url ? (
          /* Flow-based timestamp below attachments (Chatwoot pattern) */
          <div
            className={cn(
              "flex items-center justify-end gap-0.5 text-[11px] mt-1",
              isOutgoing ? "text-muted-foreground/60" : "text-muted-foreground/50"
            )}
          >
            {time}
            {isOutgoing && (
              <CheckCheck className="h-[14px] w-[14px] text-primary/60" />
            )}
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
            {isOutgoing && (
              <CheckCheck className="h-[14px] w-[14px] text-primary/60" />
            )}
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
    </div>
  );
});
