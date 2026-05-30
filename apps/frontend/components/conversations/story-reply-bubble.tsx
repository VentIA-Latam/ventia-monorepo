"use client";

import { Instagram } from "lucide-react";
import type { AttachmentBrief } from "@/lib/types/messaging";

function getAttUrl(att: AttachmentBrief): string {
  return att.file_url || att.data_url || "";
}

/* ── Story reply context — preview of the story the contact replied to, rendered
   edge-to-edge above the message content (WhatsApp-style quoted context). The media is
   mirrored to our storage on the backend so it survives the story's ~24h expiry. ── */
export function StoryReplyBubble({
  attachment,
  onImageClick,
}: {
  attachment?: AttachmentBrief;
  onImageClick?: (src: string) => void;
}) {
  const url = attachment ? getAttUrl(attachment) : "";
  const isVideo = attachment?.file_type === "video";

  return (
    <div className="-mx-3 -mt-1.5 mb-1.5 overflow-hidden bg-muted/40">
      {url ? (
        isVideo ? (
          <video src={url} controls className="block w-full max-h-48 object-cover" />
        ) : (
          <button
            type="button"
            onClick={() => onImageClick?.(url)}
            className="block w-full cursor-pointer overflow-hidden bg-black/5"
          >
            <img
              src={url}
              alt="Historia"
              className="w-full max-h-48 object-cover hover:opacity-95 transition-opacity"
            />
          </button>
        )
      ) : null}

      <div className="border-t border-border/40 px-3 py-1.5 flex items-center gap-1.5">
        <Instagram className="h-3 w-3 text-muted-foreground/60" />
        <span className="text-[11px] text-muted-foreground/60 font-medium">
          Respondió a tu historia
        </span>
      </div>
    </div>
  );
}
