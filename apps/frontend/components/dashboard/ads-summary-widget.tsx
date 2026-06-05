"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ArrowDown, ArrowUp, ImageOff, Megaphone } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AdSummaryItem, AdsSummaryResponse } from "@/lib/services/metrics-service";

type SortKey = "started" | "rate";
type SortDir = "asc" | "desc";

interface AdsSummaryWidgetProps {
  data?: AdsSummaryResponse;
}

export function AdsSummaryWidget({ data }: AdsSummaryWidgetProps) {
  const [sortKey, setSortKey] = useState<SortKey>("started");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const ads = data?.ads;

  const sortedAds = useMemo(() => {
    if (!ads || ads.length === 0) return [];
    const copy = [...ads];
    copy.sort((a, b) => {
      const av =
        sortKey === "started" ? a.conversations_started : a.conversion_rate;
      const bv =
        sortKey === "started" ? b.conversations_started : b.conversion_rate;
      const diff = sortDir === "desc" ? bv - av : av - bv;
      return diff !== 0 ? diff : a.ad_id.localeCompare(b.ad_id);
    });
    return copy.slice(0, 10);
  }, [ads, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  if (!data || !ads || ads.length === 0) {
    return (
      <Card className="flex flex-col w-full">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Performance por anuncio
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center pt-0">
          <div className="flex flex-col items-center py-10 text-center gap-3">
            <Megaphone className="h-8 w-8 text-muted-foreground/40" aria-hidden />
            <p className="text-sm text-muted-foreground max-w-xs">
              Aún no hay conversaciones iniciadas desde anuncios de Meta en este
              período.
            </p>
            <Button variant="outline" size="sm" asChild>
              <a
                href="https://business.facebook.com/"
                target="_blank"
                rel="noopener noreferrer"
              >
                Ir a Meta Ads
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col w-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">
          Performance por anuncio
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          {data.total_ads > 10
            ? `Top 10 de ${data.total_ads} anuncios con conversaciones en el período`
            : `${data.total_ads} ${data.total_ads === 1 ? "anuncio" : "anuncios"} con conversaciones en el período`}
        </p>
      </CardHeader>
      <CardContent className="flex-1 pt-0">
        <div className="flex items-center justify-between border-b border-border/40 pb-2 mb-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <span className="flex-1">Anuncio</span>
          <div className="flex items-center gap-4 shrink-0">
            <SortButton
              label="Iniciadas"
              active={sortKey === "started"}
              dir={sortDir}
              onClick={() => toggleSort("started")}
            />
            <span className="w-14 text-right hidden sm:inline">Conv.</span>
            <SortButton
              label="Tasa"
              active={sortKey === "rate"}
              dir={sortDir}
              onClick={() => toggleSort("rate")}
              className="w-16 justify-end"
            />
          </div>
        </div>
        <ul className="space-y-3">
          {sortedAds.map((ad) => (
            <AdRow key={ad.ad_id} ad={ad} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function SortButton({
  label,
  active,
  dir,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
  className?: string;
}) {
  const ariaLabel = active
    ? `Ordenar por ${label}, actualmente ${dir === "desc" ? "descendente" : "ascendente"}`
    : `Ordenar por ${label}`;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 hover:text-foreground transition-colors",
        active && "text-foreground font-semibold",
        className,
      )}
    >
      {label}
      {active &&
        (dir === "desc" ? (
          <ArrowDown className="h-3 w-3" aria-hidden />
        ) : (
          <ArrowUp className="h-3 w-3" aria-hidden />
        ))}
    </button>
  );
}

const CHANNEL_ICONS: Record<string, { src: string; label: string }> = {
  instagram: { src: "/external-icons/instagram-icon.svg", label: "Instagram" },
  whatsapp: { src: "/external-icons/whatsapp-icon.svg", label: "WhatsApp" },
};

function ChannelIcon({ channel }: { channel: AdSummaryItem["channel"] }) {
  const icon = channel ? CHANNEL_ICONS[channel] : null;
  if (!icon) return null;
  return (
    <Image
      src={icon.src}
      alt={icon.label}
      title={icon.label}
      width={14}
      height={14}
      unoptimized
      className="shrink-0"
    />
  );
}

function AdRow({ ad }: { ad: AdSummaryItem }) {
  const [imgError, setImgError] = useState(false);
  const showImage = ad.image_url && !imgError;

  return (
    <li className="flex items-center gap-3">
      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md bg-muted/60 border border-border/30">
        {showImage ? (
          <Image
            src={ad.image_url!}
            alt={ad.headline ?? ad.ad_id}
            fill
            sizes="44px"
            unoptimized
            loading="lazy"
            decoding="async"
            onError={() => setImgError(true)}
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <ImageOff
              className="h-4 w-4 text-muted-foreground/50"
              aria-hidden
            />
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
          <ChannelIcon channel={ad.channel} />
          <span className="truncate">{ad.headline ?? "Anuncio sin título"}</span>
        </p>
        {ad.source_url ? (
          <a
            href={ad.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground hover:underline truncate inline-block max-w-full"
          >
            Ver en Meta
          </a>
        ) : (
          <span className="text-xs text-muted-foreground/70">{ad.ad_id}</span>
        )}
      </div>
      <div className="flex items-center gap-4 shrink-0">
        <span className="text-sm tabular-nums text-foreground w-10 text-right">
          {ad.conversations_started}
        </span>
        <span className="text-sm tabular-nums text-muted-foreground w-14 text-right hidden sm:inline">
          {ad.conversations_converted}
        </span>
        <RatePill rate={ad.conversion_rate} />
      </div>
    </li>
  );
}

function RatePill({ rate }: { rate: number }) {
  const tone =
    rate >= 50
      ? "bg-volt/15 text-volt border-volt/20"
      : rate >= 20
        ? "bg-warning/15 text-warning border-warning/20"
        : "bg-muted/50 text-muted-foreground border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center justify-end rounded-full border px-2 py-0.5 text-xs font-semibold tabular-nums w-16",
        tone,
      )}
    >
      {rate.toFixed(1)}%
    </span>
  );
}
