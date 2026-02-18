"use client";

import dynamic from "next/dynamic";
import { MapPin } from "lucide-react";
import type { AttachmentBrief } from "@/lib/types/messaging";

const LocationMap = dynamic(
  () => import("./location-map").then((mod) => mod.LocationMap),
  { ssr: false, loading: () => <div className="h-32 w-56 bg-muted/50 rounded-md animate-pulse" /> }
);

interface LocationBubbleProps {
  attachment: AttachmentBrief;
}

export function LocationBubble({ attachment }: LocationBubbleProps) {
  const lat = attachment.coordinates_lat;
  const lng = attachment.coordinates_long;

  if (lat == null || lng == null) return null;

  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <a
      href={mapsUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-md overflow-hidden w-56 hover:opacity-90 transition-opacity"
    >
      <div className="h-32 w-full isolate">
        <LocationMap lat={lat} lng={lng} />
      </div>
      <div className="flex items-center gap-1.5 px-2 py-1.5 bg-muted/30 text-xs text-muted-foreground">
        <MapPin className="h-3 w-3 shrink-0" />
        <span className="truncate">Abrir en Google Maps</span>
      </div>
    </a>
  );
}
