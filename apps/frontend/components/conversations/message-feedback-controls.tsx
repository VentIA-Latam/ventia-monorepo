"use client";

import { memo, useCallback, useState } from "react";
import { ThumbsUp, ThumbsDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  setMessageFeedback,
  deleteMessageFeedback,
} from "@/lib/api-client/messaging";
import type { Message, MessageFeedback, FeedbackRating } from "@/lib/types/messaging";

interface MessageFeedbackControlsProps {
  message: Message;
  conversationId: number | string;
  tenantId?: number;
  /** Notifica al padre para actualizar el feedback del mensaje en su estado. */
  onFeedbackChange?: (messageId: number | string, feedback: MessageFeedback | null) => void;
}

const COMMENT_MAX = 2000;

/**
 * Like/dislike del agente sobre un mensaje de IA. El dislike exige un comentario
 * (popover); el like es un click directo. Re-click sobre el voto activo lo quita.
 * Actualización optimista vía onFeedbackChange con rollback + toast en error.
 */
export const MessageFeedbackControls = memo(function MessageFeedbackControls({
  message,
  conversationId,
  tenantId,
  onFeedbackChange,
}: MessageFeedbackControlsProps) {
  const { toast } = useToast();
  const current = message.feedback ?? null;
  const [submitting, setSubmitting] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");

  const isLike = current?.rating === "like";
  const isDislike = current?.rating === "dislike";

  const apply = useCallback(
    async (
      rating: FeedbackRating | null,
      comment?: string,
    ): Promise<boolean> => {
      const prev = current;
      // Optimistic
      const optimistic: MessageFeedback | null =
        rating === null
          ? null
          : {
              rating,
              comment: rating === "dislike" ? comment ?? null : null,
              user_id: prev?.user_id ?? 0,
              updated_at: prev?.updated_at ?? "",
            };
      onFeedbackChange?.(message.id, optimistic);
      setSubmitting(true);

      try {
        if (rating === null) {
          await deleteMessageFeedback(conversationId, message.id, tenantId);
          onFeedbackChange?.(message.id, null);
        } else {
          const res = await setMessageFeedback(
            conversationId,
            message.id,
            rating,
            comment,
            tenantId,
          );
          onFeedbackChange?.(message.id, res?.data ?? optimistic);
        }
        return true;
      } catch (err) {
        console.error("[feedback]", err);
        onFeedbackChange?.(message.id, prev); // rollback
        toast({
          variant: "destructive",
          title: "No se pudo guardar el feedback",
          description: "Intenta de nuevo en unos segundos.",
        });
        return false;
      } finally {
        setSubmitting(false);
      }
    },
    [current, conversationId, message.id, tenantId, onFeedbackChange, toast],
  );

  const handleLike = useCallback(() => {
    if (submitting) return;
    void apply(isLike ? null : "like");
  }, [submitting, isLike, apply]);

  const handleOpenDislike = useCallback(
    (open: boolean) => {
      if (submitting) return;
      if (open) setCommentDraft(current?.comment ?? "");
      setPopoverOpen(open);
    },
    [submitting, current],
  );

  const handleSubmitDislike = useCallback(async () => {
    const comment = commentDraft.trim();
    if (!comment) return;
    const ok = await apply("dislike", comment);
    if (ok) setPopoverOpen(false);
  }, [commentDraft, apply]);

  const handleRemoveDislike = useCallback(async () => {
    const ok = await apply(null);
    if (ok) setPopoverOpen(false);
  }, [apply]);

  return (
    <div
      className={cn(
        // Chip flotante estilo reacción de WhatsApp: absoluto (no descuadra la
        // burbuja) justo debajo del borde inferior-izquierdo del mensaje, sin
        // tapar el texto.
        "absolute left-1 top-full mt-1 z-10",
        "flex items-center gap-0.5 rounded-full bg-card shadow-md border border-border/60 px-1 py-0.5",
        // Visible al hover de la burbuja o si ya hay voto; persistente en touch.
        "opacity-0 motion-safe:transition-opacity",
        "group-hover:opacity-100 group-focus-within:opacity-100",
        "[@media(hover:none)]:opacity-100",
        current && "opacity-100",
      )}
    >
      <button
        type="button"
        onClick={handleLike}
        disabled={submitting}
        aria-label={isLike ? "Quitar like" : "Marcar como buena respuesta"}
        aria-pressed={isLike}
        className={cn(
          "flex h-5 w-5 items-center justify-center rounded-full transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40",
          isLike
            ? "text-success"
            : "text-muted-foreground/70 hover:text-success",
        )}
      >
        <ThumbsUp className="h-3.5 w-3.5" fill={isLike ? "currentColor" : "none"} />
      </button>

      <Popover open={popoverOpen} onOpenChange={handleOpenDislike}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={submitting}
            aria-label={isDislike ? "Editar comentario" : "Marcar como mala respuesta"}
            aria-pressed={isDislike}
            className={cn(
              "flex h-5 w-5 items-center justify-center rounded-full transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-volt/40",
              isDislike
                ? "text-destructive"
                : "text-muted-foreground/70 hover:text-destructive",
            )}
          >
            <ThumbsDown className="h-3.5 w-3.5" fill={isDislike ? "currentColor" : "none"} />
          </button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-72 p-3" onClick={(e) => e.stopPropagation()}>
          <p id="feedback-comment-label" className="text-sm font-medium mb-1.5">
            ¿Qué estuvo mal en esta respuesta?
          </p>
          <Textarea
            value={commentDraft}
            onChange={(e) => setCommentDraft(e.target.value.slice(0, COMMENT_MAX))}
            placeholder="Describe el problema (obligatorio)…"
            rows={3}
            autoFocus
            aria-labelledby="feedback-comment-label"
            aria-required="true"
            className="resize-none text-sm"
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            {isDislike ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemoveDislike}
                disabled={submitting}
                className="text-muted-foreground"
              >
                Quitar voto
              </Button>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPopoverOpen(false)}
                disabled={submitting}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleSubmitDislike}
                disabled={submitting || !commentDraft.trim()}
              >
                {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Enviar"}
              </Button>
            </div>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
});
