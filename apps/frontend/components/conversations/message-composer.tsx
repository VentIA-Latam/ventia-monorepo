"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Send, Smile, Plus, Mic, X, FileText, Image as ImageIcon,
  Zap, Tag, Bot, UserRound, CheckCircle2, CircleDot, type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import type { Message, CannedResponse, CannedResponseAction, Label } from "@/lib/types/messaging";
import { getLabels } from "@/lib/api-client/messaging";
import { QuotedMessagePreview } from "./quoted-message-preview";
import { CannedResponsePicker, type CannedResponsePickerHandle } from "./canned-response-picker";

const STATUS_LABELS: Record<string, string> = {
  open: "Abierta",
  pending: "Pendiente",
  resolved: "Resuelta",
  snoozed: "Pospuesta",
};

// Resolve label ids to names (falls back to a generic count if not loaded / missing).
function labelText(params: Record<string, unknown>, verb: string, labelById: Map<number, string>): string {
  const ids = Array.isArray(params.labels) ? (params.labels as unknown[]) : [];
  const names = ids.map((id) => labelById.get(Number(id))).filter(Boolean) as string[];
  if (names.length) return `${verb} ${names.join(", ")}`;
  return ids.length > 1 ? `${verb} ${ids.length} etiquetas` : `${verb} etiqueta`;
}

// Human-readable summary (icon + text) of an action, for the "Al enviar:" chip.
function describeAction(
  action: CannedResponseAction,
  labelById: Map<number, string>
): { Icon: LucideIcon; text: string } | null {
  const params = action.action_params ?? {};
  switch (action.action_name) {
    case "add_label":
      return { Icon: Tag, text: labelText(params, "Agrega", labelById) };
    case "remove_label":
      return { Icon: Tag, text: labelText(params, "Quita", labelById) };
    case "set_ai_agent":
      return params.enabled
        ? { Icon: Bot, text: "Pasar a IA" }
        : { Icon: UserRound, text: "Pasar a soporte humano" };
    case "change_status":
      return { Icon: CircleDot, text: `Estado: ${STATUS_LABELS[String(params.status)] ?? params.status}` };
    case "resolve_conversation":
      return { Icon: CheckCircle2, text: "Resolver conversación" };
    default:
      return null;
  }
}

const importAudioRecorder = () => import("./audio-recorder").then((mod) => ({ default: mod.AudioRecorder }));
const AudioRecorder = dynamic(importAudioRecorder, {
  ssr: false,
  loading: () => (
    <div className="flex items-center gap-2 w-full animate-pulse">
      <div className="h-10 w-10 rounded-full bg-muted/50" />
      <div className="flex-1 h-8 rounded bg-muted/50" />
      <div className="h-10 w-10 rounded-full bg-muted/50" />
    </div>
  ),
});

function WhatsAppTemplateIcon({ className }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" className={className} fill="currentColor">
      <path d="m187.58 144.84l-32-16a8 8 0 0 0-8 .5l-14.69 9.8a40.55 40.55 0 0 1-16-16l9.8-14.69a8 8 0 0 0 .5-8l-16-32A8 8 0 0 0 104 64a40 40 0 0 0-40 40a88.1 88.1 0 0 0 88 88a40 40 0 0 0 40-40a8 8 0 0 0-4.42-7.16M152 176a72.08 72.08 0 0 1-72-72a24 24 0 0 1 19.29-23.54l11.48 23L101 118a8 8 0 0 0-.73 7.51a56.47 56.47 0 0 0 30.15 30.15A8 8 0 0 0 138 155l14.61-9.74l23 11.48A24 24 0 0 1 152 176M128 24a104 104 0 0 0-91.82 152.88l-11.35 34.05a16 16 0 0 0 20.24 20.24l34.05-11.35A104 104 0 1 0 128 24m0 192a87.87 87.87 0 0 1-44.06-11.81a8 8 0 0 0-6.54-.67L40 216l12.47-37.4a8 8 0 0 0-.66-6.54A88 88 0 1 1 128 216" />
    </svg>
  );
}

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

const MAX_MEDIA_SIZE = 16 * 1024 * 1024; // 16MB for images/audio/video
const MAX_DOC_SIZE = 100 * 1024 * 1024; // 100MB for documents

function isMediaFile(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("audio/") || file.type.startsWith("video/");
}

interface MessageComposerProps {
  /** cannedResponseId is the "armed" response (if any) whose actions fire on send. */
  onSend: (content: string, file?: File, cannedResponseId?: number) => void;
  disabled?: boolean;
  onOpenTemplates?: () => void;
  audioFormat?: "mp3" | "wav";
  replyingTo?: Message | null;
  onCancelReply?: () => void;
  tenantId?: number;
}

export function MessageComposer({ onSend, disabled, onOpenTemplates, audioFormat = "mp3", replyingTo, onCancelReply, tenantId }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [cannedOpen, setCannedOpen] = useState(false);
  // The canned response the current draft originated from. Its actions fire on send and
  // are previewed in the "Al enviar:" chip; "last inserted wins" and it is cleared on
  // send, on disarm, or when the draft is emptied.
  const [armedResponse, setArmedResponse] = useState<CannedResponse | null>(null);
  // Label catalog, fetched lazily the first time a response with a label action is armed,
  // so the chip can show real label names without a fetch on every conversation.
  const [labels, setLabels] = useState<Label[] | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cannedPickerRef = useRef<CannedResponsePickerHandle>(null);

  const closeCanned = useCallback(() => {
    setCannedOpen(false);
  }, []);

  const labelById = useMemo(() => {
    const map = new Map<number, string>();
    (labels ?? []).forEach((l) => map.set(l.id, l.title));
    return map;
  }, [labels]);

  // Lazy-load the label catalog the first time an armed response references labels.
  useEffect(() => {
    if (labels !== null) return;
    const usesLabels = armedResponse?.actions?.some(
      (a) => a.action_name === "add_label" || a.action_name === "remove_label"
    );
    if (!usesLabels) return;

    let cancelled = false;
    getLabels(tenantId)
      .then((res) => { if (!cancelled) setLabels(res.data ?? []); })
      .catch(() => { if (!cancelled) setLabels([]); }); // fall back to generic text; don't retry-loop
    return () => { cancelled = true; };
  }, [armedResponse, labels, tenantId]);

  // Clean up object URL on unmount or file change
  useEffect(() => {
    return () => {
      if (filePreview) URL.revokeObjectURL(filePreview);
    };
  }, [filePreview]);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, []);

  // Insert a selected canned response (always via the "/" trigger): the whole "/code"
  // token is replaced by the response text, and the message is "armed" with the
  // response id so its actions fire on send (last inserted wins).
  const insertCanned = useCallback(
    (response: CannedResponse) => {
      setContent(response.content);
      setArmedResponse(response);
      setCannedOpen(false);
      requestAnimationFrame(() => {
        textareaRef.current?.focus();
        adjustHeight();
      });
    },
    [adjustHeight]
  );

  const clearFile = useCallback(() => {
    setSelectedFile(null);
    setFileSizeError(null);
    if (filePreview) {
      URL.revokeObjectURL(filePreview);
      setFilePreview(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [filePreview]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = isMediaFile(file) ? MAX_MEDIA_SIZE : MAX_DOC_SIZE;
    if (file.size > maxSize) {
      const maxMB = maxSize / (1024 * 1024);
      setFileSizeError(`El archivo excede el límite de ${maxMB}MB`);
      setSelectedFile(null);
      setFilePreview(null);
      return;
    }

    setFileSizeError(null);
    setSelectedFile(file);

    if (file.type.startsWith("image/")) {
      setFilePreview(URL.createObjectURL(file));
    } else {
      setFilePreview(null);
    }
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed && !selectedFile) return;
    onSend(trimmed, selectedFile ?? undefined, armedResponse?.id);
    setContent("");
    setArmedResponse(null);
    setCannedOpen(false);
    clearFile();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [content, selectedFile, armedResponse, onSend, clearFile]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Ignore keystrokes while an IME composition is active (e.g. Enter that
      // confirms a candidate) so we don't send a half-composed message.
      if (e.nativeEvent.isComposing) return;
      // While the "/" canned-response picker is open, let it consume navigation keys.
      if (cannedOpen && cannedPickerRef.current?.handleKeyDown(e)) {
        e.preventDefault();
        return;
      }
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      } else if (e.key === "Escape" && replyingTo) {
        e.preventDefault();
        onCancelReply?.();
      }
    },
    [handleSend, replyingTo, onCancelReply, cannedOpen]
  );

  // Update draft text and detect the "/" trigger (draft is a single "/code" token).
  const handleContentChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = e.target.value;
      setContent(value);
      adjustHeight();
      // Emptying the draft clears the armed canned response (no orphan actions).
      if (value.length === 0) setArmedResponse(null);
      const isTrigger = value.startsWith("/") && !/\s/.test(value);
      setCannedOpen(isTrigger);
    },
    [adjustHeight]
  );

  // Focus the textarea when the user starts replying to a message (US-UX-002).
  useEffect(() => {
    if (replyingTo) textareaRef.current?.focus();
  }, [replyingTo]);

  const handleEmojiClick = useCallback(
    (emojiData: { emoji: string }) => {
      setContent((prev) => prev + emojiData.emoji);
      setShowEmoji(false);
      textareaRef.current?.focus();
    },
    []
  );

  const hasContent = content.trim().length > 0 || selectedFile !== null;

  return (
    <div
      data-testid="message-composer"
      data-audio-format={audioFormat}
      className="relative bg-muted/30 px-4 py-2.5 border-t border-border/30"
    >
      {/* Emoji picker */}
      {showEmoji && (
        <div className="absolute bottom-full left-3 mb-2 z-[60]">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={320}
            height={400}
          />
        </div>
      )}

      {/* Canned responses picker ("/" trigger) */}
      <CannedResponsePicker
        ref={cannedPickerRef}
        open={cannedOpen}
        query={content.startsWith("/") ? content.slice(1) : ""}
        tenantId={tenantId}
        onSelect={insertCanned}
        onClose={closeCanned}
      />

      {/* Quoted reply preview (US-UX-002) — above the input, dismissible */}
      {replyingTo && (
        <QuotedMessagePreview
          variant="composer"
          message={replyingTo}
          onCancel={onCancelReply}
        />
      )}

      {/* Armed canned-response actions — what will run on send (dismissible to disarm) */}
      {armedResponse && armedResponse.actions?.length > 0 && (
        <div className="mb-2 flex items-center gap-2 rounded-lg border border-volt/30 bg-volt/5 px-3 py-1.5">
          <Zap className="h-3.5 w-3.5 text-volt shrink-0" />
          <span className="text-xs font-medium text-muted-foreground shrink-0">Al enviar:</span>
          <div className="flex flex-wrap items-center gap-1.5 flex-1 min-w-0">
            {armedResponse.actions.map((action, i) => {
              const d = describeAction(action, labelById);
              if (!d) return null;
              const Icon = d.Icon;
              return (
                <span
                  key={i}
                  className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2 py-0.5 text-[11px] text-foreground"
                >
                  <Icon className="h-3 w-3 text-volt shrink-0" />
                  {d.text}
                </span>
              );
            })}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => setArmedResponse(null)}
            title="Quitar acciones de esta respuesta"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* File preview area */}
      {(selectedFile || fileSizeError) && (
        <div className="mb-2 flex items-center gap-2">
          {fileSizeError ? (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg px-3 py-2 flex-1">
              <span>{fileSizeError}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0" onClick={clearFile}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          ) : selectedFile && (
            <div className="flex items-center gap-2 bg-card rounded-lg px-3 py-2 shadow-sm">
              {filePreview ? (
                <img src={filePreview} alt="Preview" className="h-12 w-12 rounded object-cover" />
              ) : selectedFile.type.startsWith("image/") ? (
                <ImageIcon className="h-8 w-8 text-muted-foreground" />
              ) : (
                <FileText className="h-8 w-8 text-muted-foreground" />
              )}
              <div className="min-w-0">
                <p className="text-xs font-medium truncate max-w-[200px]">{selectedFile.name}</p>
                <p className="text-[11px] text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={clearFile}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        className="hidden"
        accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.rar"
        onChange={handleFileSelect}
      />

      {isRecording ? (
        <AudioRecorder
          audioFormat={audioFormat}
          onSend={(file) => {
            onSend("", file);
            setIsRecording(false);
          }}
          onCancel={() => setIsRecording(false)}
        />
      ) : (
        <div className="flex items-end gap-2">
          {/* Emoji button */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
            onClick={() => setShowEmoji((prev) => !prev)}
            type="button"
          >
            <Smile className="h-5 w-5" />
          </Button>

          {/* Attach button */}
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
            type="button"
            onClick={() => fileInputRef.current?.click()}
          >
            <Plus className="h-5 w-5" />
          </Button>

          {/* Template button */}
          {onOpenTemplates && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0 h-10 w-10 rounded-full text-muted-foreground hover:text-foreground"
              type="button"
              onClick={onOpenTemplates}
              title="Plantillas de WhatsApp"
            >
              <WhatsAppTemplateIcon className="h-5 w-5" />
            </Button>
          )}

          {/* Text input — WhatsApp style rounded */}
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleContentChange}
            onKeyDown={handleKeyDown}
            placeholder="Escribe un mensaje"
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none rounded-lg bg-card px-4 py-2.5 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-primary/20 disabled:opacity-50"
          />

          {/* Send or Mic button — circular WhatsApp style */}
          <Button
            size="icon"
            className="shrink-0 h-10 w-10 rounded-full"
            onMouseEnter={hasContent ? undefined : () => importAudioRecorder()}
            onClick={hasContent ? handleSend : () => setIsRecording(true)}
            disabled={disabled}
          >
            {hasContent ? (
              <Send className="h-4 w-4" />
            ) : (
              <Mic className="h-5 w-5" />
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
