"use client";

import { memo } from "react";
import { cn } from "@/lib/utils";
import { FileDown, CheckCheck } from "lucide-react";
import type { Message } from "@/lib/types/messaging";

interface MessageBubbleProps {
  message: Message;
}

function parseTimestamp(value: string | number | null): Date | null {
  if (value == null || value === "") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isNaN(num) && num > 1_000_000_000 && num < 10_000_000_000) {
    return new Date(num * 1000);
  }
  if (!Number.isNaN(num) && num > 1_000_000_000_000) {
    return new Date(num);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatTime(dateStr: string | number | null): string {
  const date = parseTimestamp(dateStr);
  if (!date) return "";
  return date.toLocaleTimeString("es-PE", {
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
        "flex max-w-[65%]",
        isOutgoing ? "ml-auto justify-end" : "mr-auto"
      )}
    >
      <div
        className={cn(
          "relative rounded-lg px-3 py-1.5 text-sm shadow-sm",
          isOutgoing
            ? "bg-primary/15 rounded-tr-[4px]"
            : "bg-card rounded-tl-[4px]"
        )}
      >
        {/* Sender name for incoming */}
        {!isOutgoing && message.sender && "name" in message.sender && (
          <p className="text-xs font-medium text-primary/80 mb-0.5">
            {message.sender.name}
          </p>
        )}

        {/* Content */}
        {message.content ? (
          <p className="whitespace-pre-wrap break-words">
            {message.content}
            {/* Invisible spacer so time+check don't overlap text */}
            <span className="inline-block w-[70px]" />
          </p>
        ) : null}

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-1.5 space-y-1.5">
            {message.attachments.map((att) => {
              if (att.file_type?.startsWith("image")) {
                return (
                  <img
                    key={att.id}
                    src={att.file_url || ""}
                    alt={att.filename || "Imagen"}
                    className="rounded-md max-w-full max-h-64 object-cover"
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
                    className="rounded-md max-w-full max-h-64"
                  />
                );
              }

              return (
                <a
                  key={att.id}
                  href={att.file_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-primary underline"
                >
                  <FileDown className="h-3.5 w-3.5" />
                  {att.filename || "Archivo adjunto"}
                </a>
              );
            })}
          </div>
        )}

        {/* Timestamp + checkmarks (WhatsApp style: bottom-right inside bubble) */}
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
      </div>
    </div>
  );
});
