"use client";

import { memo } from "react";
import { ExternalLink, Reply, ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CarouselCard, CarouselCardButton } from "@/lib/types/messaging";

// Static button base classes — hoisted so they aren't re-created on every render.
const BUTTON_BASE =
  "flex items-center justify-center gap-1.5 rounded-md px-3 py-[7px] text-[12.5px] font-semibold transition-colors";

/* Subtitles follow the "price · detail" convention (e.g. "S/ 199.90 · Tallas 38-44").
   Split on the first middot so the price can be emphasized; fall back gracefully. */
function splitSubtitle(subtitle?: string): { price?: string; detail?: string } {
  if (!subtitle) return {};
  const i = subtitle.indexOf("·");
  if (i === -1) return { detail: subtitle.trim() };
  return { price: subtitle.slice(0, i).trim(), detail: subtitle.slice(i + 1).trim() };
}

/* web_url → solid CTA (opens a link). postback → outline (the end user taps it to reply to the
   bot; inert in the agent's view). The two are visually distinct on purpose. */
function CardButton({ button }: { button: CarouselCardButton }) {
  if (button.type === "web_url" && button.url) {
    return (
      <a
        href={button.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(BUTTON_BASE, "bg-volt text-white hover:bg-volt/90")}
      >
        <span className="truncate">{button.title}</span>
        <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-80" />
      </a>
    );
  }

  return (
    <div
      className={cn(BUTTON_BASE, "cursor-default border border-volt/30 text-volt")}
      title="El cliente toca esto para responder"
    >
      <Reply className="h-3.5 w-3.5 shrink-0 -scale-x-100" />
      <span className="truncate">{button.title}</span>
    </div>
  );
}

function Card({ card }: { card: CarouselCard }) {
  const { price, detail } = splitSubtitle(card.subtitle);

  const media = (
    <div className="aspect-[4/3] w-full overflow-hidden bg-muted/50">
      {card.image_url ? (
        <img
          src={card.image_url}
          alt={card.title}
          loading="lazy"
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageOff className="h-7 w-7 text-muted-foreground/40" />
        </div>
      )}
    </div>
  );

  const info = (
    <div className="px-3 pt-2.5">
      <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-foreground">
        {card.title}
      </p>
      {price ? (
        <p className="mt-1 text-[14px] font-bold leading-none text-marino dark:text-foreground">
          {price}
        </p>
      ) : null}
      {detail ? (
        <p className="mt-1 line-clamp-1 text-[11px] text-muted-foreground">{detail}</p>
      ) : null}
    </div>
  );

  return (
    <article className="flex w-[182px] shrink-0 flex-col overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm">
      {card.default_action_url ? (
        <a
          href={card.default_action_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block"
        >
          {media}
          {info}
        </a>
      ) : (
        <>
          {media}
          {info}
        </>
      )}

      {card.buttons?.length ? (
        <div className="mt-auto flex flex-col gap-1.5 px-3 pb-3 pt-3">
          {card.buttons.map((b, i) => (
            <CardButton key={`${b.type}-${i}-${b.title}`} button={b} />
          ))}
        </div>
      ) : (
        <div className="pb-3" />
      )}
    </article>
  );
}

/* Horizontal carousel of product cards (Instagram generic template), for outgoing messages.
   `items-stretch` keeps every card the same height regardless of button count.
   memo: the `cards` prop is a stable reference on the message, so the carousel skips
   re-renders when its parent MessageBubble re-renders for unrelated reasons (avatar/lightbox). */
export const CarouselBubble = memo(function CarouselBubble({
  cards,
}: {
  cards: CarouselCard[];
}) {
  return (
    <div className="flex items-stretch gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
      {cards.map((card, i) => (
        <Card key={`${i}-${card.title}`} card={card} />
      ))}
    </div>
  );
});
