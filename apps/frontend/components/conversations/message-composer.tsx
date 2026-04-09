"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Send, Smile, Plus, Mic, X, FileText, Image as ImageIcon } from "lucide-react";
import dynamic from "next/dynamic";

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
  onSend: (content: string, file?: File) => void;
  disabled?: boolean;
  onOpenTemplates?: () => void;
}

export function MessageComposer({ onSend, disabled, onOpenTemplates }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreview, setFilePreview] = useState<string | null>(null);
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    onSend(trimmed, selectedFile ?? undefined);
    setContent("");
    clearFile();
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [content, selectedFile, onSend, clearFile]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

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
    <div className="relative bg-muted/30 px-4 py-2.5 border-t border-border/30">
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
            onChange={(e) => {
              setContent(e.target.value);
              adjustHeight();
            }}
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
