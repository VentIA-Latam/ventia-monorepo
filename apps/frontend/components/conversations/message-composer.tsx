"use client";

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Send, Smile, Plus, Mic } from "lucide-react";
import dynamic from "next/dynamic";

const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface MessageComposerProps {
  onSend: (content: string) => void;
  disabled?: boolean;
}

export function MessageComposer({ onSend, disabled }: MessageComposerProps) {
  const [content, setContent] = useState("");
  const [showEmoji, setShowEmoji] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const adjustHeight = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 200) + "px";
  }, []);

  const handleSend = useCallback(() => {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setContent("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [content, onSend]);

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

  const hasContent = content.trim().length > 0;

  return (
    <div className="relative bg-muted/30 px-4 py-2.5 border-t border-border/30">
      {/* Emoji picker */}
      {showEmoji && (
        <div className="absolute bottom-full left-3 mb-2 z-50">
          <EmojiPicker
            onEmojiClick={handleEmojiClick}
            width={320}
            height={400}
          />
        </div>
      )}

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
        >
          <Plus className="h-5 w-5" />
        </Button>

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
          onClick={hasContent ? handleSend : undefined}
          disabled={disabled || (hasContent && !content.trim())}
        >
          {hasContent ? (
            <Send className="h-4 w-4" />
          ) : (
            <Mic className="h-5 w-5" />
          )}
        </Button>
      </div>
    </div>
  );
}
