"use client";

import { Megaphone } from "lucide-react";
import type { ReferralData } from "@/lib/types/messaging";

function getDomain(url?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace("www.", "");
  } catch {
    return null;
  }
}

export function ReferralBubble({ referral }: { referral: ReferralData }) {
  const hasContent = referral.headline || referral.body;
  const domain = getDomain(referral.source_url);
  // Instagram CTD ads don't send a landing URL; only wrap in a link when there's a real
  // destination, otherwise `href="#"` would hijack the SPA route on click.
  const hasLink = !!referral.source_url;

  const inner = (
    <div className="bg-muted/40 overflow-hidden">
        {referral.image_url ? (
          <img
            src={referral.image_url}
            alt={referral.headline || "Anuncio"}
            className="w-full h-32 object-cover"
          />
        ) : null}

        {hasContent ? (
          <div className="px-3 py-2 space-y-0.5">
            {referral.headline ? (
              <p className="text-[13px] font-semibold leading-tight">
                {referral.headline}
              </p>
            ) : null}
            {referral.body ? (
              <p className="text-[12px] text-muted-foreground leading-snug line-clamp-2">
                {referral.body}
              </p>
            ) : null}
            {domain ? (
              <p className="text-[11px] text-muted-foreground/70">{domain}</p>
            ) : null}
          </div>
        ) : null}

        <div className="border-t border-border/40 px-3 py-1.5 flex items-center gap-1.5">
          <Megaphone className="h-3 w-3 text-muted-foreground/60" />
          <span className="text-[11px] text-muted-foreground/60 font-medium">
            Desde anuncio
          </span>
        </div>
      </div>
  );

  if (!hasLink) {
    return (
      <div className="-mx-3 -mt-1.5 mb-1.5 overflow-hidden">{inner}</div>
    );
  }

  return (
    <a
      href={referral.source_url}
      target="_blank"
      rel="noopener noreferrer"
      title={referral.source_url}
      className="block -mx-3 -mt-1.5 mb-1.5 cursor-pointer hover:opacity-95 transition-opacity overflow-hidden"
    >
      {inner}
    </a>
  );
}
