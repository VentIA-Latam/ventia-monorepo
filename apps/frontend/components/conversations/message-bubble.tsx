"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { FileDown } from "lucide-react";
import type { Message } from "@/lib/types/messaging";

interface MessageBubbleProps {
  message: Message;
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const MessageBubble = memo(function MessageBubble({
  message,
}: MessageBubbleProps) {
  const isOutgoing = message.message_type === "outgoing";
  const isActivity = message.message_type === "activity";

  if (isActivity) {
    return (
      <div className="flex justify-center py-1">
        <p className="text-xs text-muted-foreground italic bg-muted/50 px-3 py-1 rounded-full">
          {message.content}
        </p>
      </div>
    );
  }

  return (
    <div
      className={cn("flex gap-2 max-w-[85%]", isOutgoing ? "ml-auto" : "mr-auto")}
    >
      <div
        className={cn(
          "rounded-2xl px-4 py-2.5 text-sm",
          isOutgoing
            ? "bg-primary text-primary-foreground rounded-br-md"
            : "bg-muted rounded-bl-md"
        )}
      >
        {/* Sender name for incoming */}
        {!isOutgoing && message.sender && "name" in message.sender && (
          <p className="text-xs font-medium mb-1 opacity-70">
            {message.sender.name}
          </p>
        )}

        {/* Content */}
        {message.content ? (
          <p className="whitespace-pre-wrap break-words">{message.content}</p>
        ) : null}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-2 space-y-2">
            {message.attachments.map((att) => {
              if (att.file_type?.startsWith("image")) {
                return (
                  <img
                    key={att.id}
                    src={att.file_url || ""}
                    alt={att.filename || "Imagen"}
                    className="rounded-lg max-w-full max-h-64 object-cover"
                    loading="lazy"
                  />
                );
              }

              if (att.file_type?.startsWith("audio")) {
                return (
                  <audio
                    key={att.id}
                    controls
                    src={att.file_url || ""}
                    className="max-w-full"
                  />
                );
              }

              if (att.file_type?.startsWith("video")) {
                return (
                  <video
                    key={att.id}
                    controls
                    src={att.file_url || ""}
                    className="rounded-lg max-w-full max-h-64"
                  />
                );
              }

              return (
                <a
                  key={att.id}
                  href={att.file_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cn(
                    "flex items-center gap-2 text-xs underline",
                    isOutgoing ? "text-primary-foreground/80" : "text-primary"
                  )}
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {att.filename || "Archivo adjunto"}
                </a>
              );
            })}
          </div>
        )}

        {/* Time */}
        <p
          className={cn(
            "text-[10px] mt-1",
            isOutgoing ? "text-primary-foreground/60" : "text-muted-foreground"
          )}
        >
          {formatTime(message.created_at)}
        </p>
      </div>
    </div>
  );
});
