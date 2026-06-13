"use client";

import { memo, useState, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { FileDown, Check, CheckCheck, AlertCircle, X, Download, ExternalLink, Bot, Reply, Phone, Copy, Smartphone } from "lucide-react";
import type { MessageStatus, TemplateProcessedHeader, TemplateProcessedButton, WhatsAppTemplateButton, WhatsAppTemplateComponent } from "@/lib/types/messaging";
import { LocationBubble } from "./location-bubble";
import { ContactBubble } from "./contact-bubble";
import type { Message, AttachmentBrief, CtaUrlData } from "@/lib/types/messaging";
import { ReferralBubble } from "./referral-bubble";
import { StoryReplyBubble } from "./story-reply-bubble";
import { CarouselBubble } from "./carousel-bubble";
import { QuotedMessagePreview } from "./quoted-message-preview";
import { MessageFeedbackControls } from "./message-feedback-controls";
import type { MessageFeedback } from "@/lib/types/messaging";
import { formatTime, getSenderRole, getInitials } from "@/lib/utils/messaging";
import { formatWhatsAppText } from "@/lib/utils/whatsapp-format";
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

/* ── Template Header (image/video/document above the bubble content) ── */
const TemplateHeader = memo(function TemplateHeader({
  header,
  onImageClick,
}: {
  header: TemplateProcessedHeader;
  onImageClick: (src: string) => void;
}) {
  const url = header.media_url;
  if (!url) return null;

  const mediaType = (header.media_type ?? "image").toLowerCase();

  if (mediaType === "image") {
    return (
      <button
        type="button"
        onClick={() => onImageClick(url)}
        className="-mx-3 -mt-1.5 mb-1.5 block w-[calc(100%+1.5rem)] cursor-pointer overflow-hidden bg-black/5"
      >
        <img
          src={url}
          alt={header.media_name || "Imagen del template"}
          className="w-full max-h-48 object-contain hover:opacity-95 transition-opacity"
        />
      </button>
    );
  }

  if (mediaType === "video") {
    return (
      <video
        src={url}
        controls
        className="-mx-3 -mt-1.5 mb-1.5 block w-[calc(100%+1.5rem)] max-h-48"
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md bg-muted/30 px-3 py-2 mb-1.5"
    >
      <FileDown className="h-4 w-4 text-muted-foreground shrink-0" />
      <p className="text-sm truncate min-w-0">{header.media_name || "Documento adjunto"}</p>
    </a>
  );
});

/* ── Media attachments rendered edge-to-edge at the top of the bubble (WhatsApp-style) ── */
const MediaAttachmentsTop = memo(function MediaAttachmentsTop({
  attachments,
  onImageClick,
}: {
  attachments: AttachmentBrief[];
  onImageClick: (src: string) => void;
}) {
  return (
    <div className="-mx-3 -mt-1.5 mb-1.5 flex flex-col gap-0.5">
      {attachments.map((att) => {
        const url = getAttUrl(att);
        if (att.file_type === "image") {
          return (
            <button
              key={att.id}
              type="button"
              onClick={() => onImageClick(url)}
              className="block w-full cursor-pointer overflow-hidden bg-black/5"
            >
              <img
                src={url}
                alt={att.filename || "Imagen"}
                className="w-full max-h-64 object-cover hover:opacity-95 transition-opacity"
              />
            </button>
          );
        }
        return (
          <video
            key={att.id}
            src={url}
            controls
            className="block w-full max-h-64"
          />
        );
      })}
    </div>
  );
});

/* ── Template Buttons (stacked WhatsApp-style action chips below the body) ── */
interface TemplateButtonsProps {
  buttons: WhatsAppTemplateButton[];
  processedButtons?: (TemplateProcessedButton | null)[];
  isOutgoing: boolean;
  timestamp: React.ReactNode;
}

const TemplateButtons = memo(function TemplateButtons({
  buttons,
  processedButtons,
  isOutgoing,
  timestamp,
}: TemplateButtonsProps) {
  const handleCopy = useCallback((value: string) => {
    void navigator.clipboard?.writeText(value);
  }, []);

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-end gap-0.5 text-[11px] mt-1",
          isOutgoing ? "text-muted-foreground/60" : "text-muted-foreground/50"
        )}
      >
        {timestamp}
      </div>
      <div className="-mx-3 -mb-1.5 mt-2 flex flex-col">
        {buttons.map((btn, i) => {
          const dividerClass = cn(
            "h-px",
            isOutgoing ? "bg-marino/10" : "bg-border/50"
          );
          const baseClass = cn(
            "flex items-center justify-center gap-2 py-2.5 text-[13px] font-semibold transition-colors",
            isOutgoing ? "text-volt" : "text-volt"
          );
          const interactiveClass = cn(
            baseClass,
            isOutgoing ? "hover:bg-marino/5 cursor-pointer" : "hover:bg-muted/40 cursor-pointer"
          );
          const inertClass = cn(baseClass, "cursor-default opacity-90");

          let actionEl: React.ReactNode;
          if (btn.type === "URL") {
            const param = processedButtons?.[i]?.parameter ?? "";
            const resolvedUrl = btn.url ? btn.url.replace("{{1}}", param) : "#";
            actionEl = (
              <a
                href={resolvedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={interactiveClass}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {btn.text}
              </a>
            );
          } else if (btn.type === "PHONE_NUMBER") {
            actionEl = (
              <a
                href={`tel:${btn.phone_number ?? ""}`}
                className={interactiveClass}
              >
                <Phone className="h-3.5 w-3.5" />
                {btn.text}
              </a>
            );
          } else if (btn.type === "COPY_CODE") {
            const param = processedButtons?.[i]?.parameter ?? "";
            actionEl = (
              <button
                type="button"
                onClick={() => handleCopy(param)}
                className={interactiveClass}
              >
                <Copy className="h-3.5 w-3.5" />
                {btn.text}
              </button>
            );
          } else {
            actionEl = (
              <div className={inertClass}>
                <Reply className="h-3.5 w-3.5" />
                {btn.text}
              </div>
            );
          }

          return (
            <div key={`${btn.type}-${i}-${btn.text}`}>
              <div className={dividerClass} />
              {actionEl}
            </div>
          );
        })}
      </div>
    </>
  );
});

function findComponent(
  components: WhatsAppTemplateComponent[] | undefined,
  type: WhatsAppTemplateComponent["type"]
): WhatsAppTemplateComponent | undefined {
  return components?.find((c) => c.type === type);
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
  channelType?: string | null;
  onReply?: (message: Message) => void;
  /** Mensaje citado ya resuelto (US-UX-002); undefined si está fuera de la ventana cargada. */
  quotedMessage?: Message;
  /** Salta al mensaje original al hacer click en el quote. */
  onQuotedClick?: (message: Message) => void;
  /** Conversación actual — necesaria para guardar el feedback de mensajes de IA. */
  conversationId?: number | string;
  /** Tenant override (SUPERADMIN). */
  tenantId?: number;
  /** Si el rol del usuario puede evaluar (SUPERADMIN/ADMIN/VENTAS). */
  canGiveFeedback?: boolean;
  /** Actualiza el feedback del mensaje en el estado del padre (optimista). */
  onFeedbackChange?: (messageId: number | string, feedback: MessageFeedback | null) => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  showAvatar = true,
  channelType,
  onReply,
  quotedMessage,
  onQuotedClick,
  conversationId,
  tenantId,
  canGiveFeedback = false,
  onFeedbackChange,
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
              <span className="inline-block w-[76px]" />
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
  const channelName =
    channelType === "Channel::Instagram"
      ? "Instagram"
      : channelType === "Channel::Whatsapp"
        ? "WhatsApp"
        : "móvil";
  const avatarTooltip =
    senderRole === "ai"
      ? "Enviado por: IA"
      : senderRole === "agent_mobile"
        ? `Enviado por: Agente (${channelName})`
        : `Enviado por: ${operatorName ?? "operador"}`;

  const isTemplate = message.message_type === "template";
  const templateParams = isTemplate ? message.additional_attributes?.template_params : undefined;
  const templateHeader = templateParams?.processed_params?.header;
  const templateHasHeaderMedia = !!templateHeader?.media_url;
  const snapshotButtonsComponent = findComponent(
    templateParams?.template_snapshot?.components,
    "BUTTONS"
  );
  const templateButtons = snapshotButtonsComponent?.buttons ?? [];
  const templateHasButtons = templateButtons.length > 0;

  // Single-pass partition (js-combine-iterations): media goes edge-to-edge at top, rest stays inline below.
  // The story-reply preview (meta.story_reply) is pulled out so it renders as quoted context, not a normal attachment.
  const mediaAttachments: AttachmentBrief[] = [];
  const otherAttachments: AttachmentBrief[] = [];
  let storyAttachment: AttachmentBrief | undefined;
  for (const att of message.attachments ?? []) {
    if (att.meta?.story_reply === true) {
      storyAttachment = att;
    } else if (att.file_type === "image" || att.file_type === "video") {
      mediaAttachments.push(att);
    } else {
      otherAttachments.push(att);
    }
  }
  const hasStoryReply = !isOutgoing && (!!storyAttachment || !!message.content_attributes?.reply_to_story);
  const hasMediaAttachment = mediaAttachments.length > 0;
  const hasOtherAttachment = otherAttachments.length > 0;
  const carouselCards = message.content_attributes?.cards;
  const hasCards = !!carouselCards && carouselCards.length > 0;

  // Quoted reply (US-UX-002): hasQuote drives rendering; quotedMessage is resolved by the parent.
  const hasQuote = !!message.content_attributes?.in_reply_to;
  // Stable onClick para que el `memo()` de QuotedMessagePreview no se invalide
  // cada vez que el padre re-renderiza por mensajes nuevos vía WS.
  const onQuotedPreviewClick = useCallback(
    () => {
      if (quotedMessage && onQuotedClick) onQuotedClick(quotedMessage);
    },
    [quotedMessage, onQuotedClick]
  );

  return (
    <div
      className={cn(
        // `w-fit` para que el container se ajuste al ancho real del bubble.
        // Sin esto, el outer ocupaba todo el max-w y los elementos absolutos
        // posicionados con -left-9 / -right-9 (botón Responder) quedaban
        // colgando lejos del mensaje.
        "group relative flex w-fit",
        hasCards
          ? "max-w-[min(80%,520px)]"
          : isTemplate || hasMediaAttachment
            ? "max-w-[340px]"
            : "max-w-[min(65%,500px)]",
        isOutgoing ? "ml-auto justify-end" : "mr-auto"
      )}
    >
      <div
        className={cn(
          "relative text-sm min-w-0",
          // Carousels sit on the chat background (like a catalog), not inside the colored bubble.
          hasCards
            ? ""
            : cn(
                "rounded-lg px-3 py-1.5 shadow-sm overflow-hidden min-w-[120px]",
                hasReferral && "w-[280px]",
                isOutgoing
                  ? "bg-chat-outgoing rounded-tr-[4px]"
                  : "bg-card rounded-tl-[4px]"
              )
        )}
      >
        {/* Quoted reply context (US-UX-002) — shown at the top of the bubble, WhatsApp-style */}
        {hasQuote ? (
          <QuotedMessagePreview
            variant="bubble"
            message={quotedMessage}
            isOutgoing={isOutgoing}
            onClick={onQuotedPreviewClick}
          />
        ) : null}

        {/* Template header media (image/video/doc) — rendered edge-to-edge above content */}
        {templateHasHeaderMedia && templateHeader ? (
          <TemplateHeader header={templateHeader} onImageClick={setLightboxSrc} />
        ) : null}

        {/* Image/video attachments — edge-to-edge above caption, WhatsApp-style */}
        {hasMediaAttachment ? (
          <MediaAttachmentsTop attachments={mediaAttachments} onImageClick={setLightboxSrc} />
        ) : null}

        {/* Carousel (Instagram generic template) — on the chat background, not in a bubble */}
        {hasCards ? (
          <div className="mb-1">
            <CarouselBubble cards={carouselCards!} />
          </div>
        ) : null}

        {/* Story-reply context for incoming messages that replied to a story */}
        {hasStoryReply ? (
          <StoryReplyBubble attachment={storyAttachment} onImageClick={setLightboxSrc} />
        ) : null}

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
            {formatWhatsAppText(message.content)}
            {/* Invisible spacer so time+check don't overlap text (skip for CTA/template-buttons — flow timestamp) */}
            {!message.content_attributes?.cta_url && !templateHasButtons && <span className="inline-block w-[76px]" />}
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

        {/* Non-media attachments (audio, file, location, contact) — inline below content */}
        {hasOtherAttachment ? (
          <div className="mt-1.5 space-y-1.5">
            {otherAttachments.map((att) => {
              if (att.file_type === "audio") {
                return (
                  <AudioPlayer
                    key={att.id}
                    src={getAttUrl(att)}
                    isOutgoing={isOutgoing}
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
        ) : null}

        {/* Template buttons: timestamp + WhatsApp-style action chips below the body */}
        {templateHasButtons ? (
          <TemplateButtons
            buttons={templateButtons}
            processedButtons={templateParams?.processed_params?.buttons}
            isOutgoing={isOutgoing}
            timestamp={
              <>
                {time}
                {isOutgoing && <StatusIcon status={message.status} />}
              </>
            }
          />
        ) : null}

        {/* Timestamp + checkmarks (skip for CTA / template-with-buttons — already rendered above) */}
        {message.content_attributes?.cta_url || templateHasButtons ? null : hasOtherAttachment || hasCards || (hasMediaAttachment && !message.content) ? (
          /* Flow timestamp below non-media attachments, carousel, or media without caption
             (an absolute timestamp would overlap an edge-to-edge image) */
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

      {/* Reply action — appears on hover (US-UX-002).
          En touch (`hover: none`) no hay hover, así que el botón queda visible
          siempre (sin esto, el feature es invisible en mobile/tablet).
          `group-focus-within` lo expone también cuando hay focus dentro del bubble. */}
      {onReply && (
        <button
          type="button"
          onClick={() => onReply(message)}
          aria-label="Responder"
          className={cn(
            "absolute top-1/2 z-10 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-card text-muted-foreground shadow-sm",
            "opacity-0 motion-safe:transition-opacity motion-safe:duration-150",
            "group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100",
            "[@media(hover:none)]:opacity-100",
            "hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40",
            isOutgoing ? "-left-9" : "-right-9"
          )}
        >
          <Reply className="h-4 w-4" />
        </button>
      )}

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

      {/* Feedback like/dislike — solo en respuestas del bot/IA evaluables.
          message_type === "outgoing" excluye templates (el backend rechaza no-IA
          con 422); canGiveFeedback respeta el rol (VIEWER/LOGISTICA no votan). */}
      {senderRole === "ai" &&
        message.message_type === "outgoing" &&
        canGiveFeedback &&
        conversationId != null && (
          <MessageFeedbackControls
            message={message}
            conversationId={conversationId}
            tenantId={tenantId}
            onFeedbackChange={onFeedbackChange}
          />
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
                  : senderRole === "agent_mobile"
                    ? "bg-agent text-white border border-agent/30"
                    : "bg-cielo text-marino dark:bg-info-bg dark:text-info dark:border dark:border-info/30"
              )}
            >
              {senderRole === "ai" ? (
                <Bot className="h-3 w-3" strokeWidth={2.5} />
              ) : senderRole === "agent_mobile" ? (
                <Smartphone className="h-3 w-3" strokeWidth={2.5} />
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
