"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default icon paths for Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const TILE_URL = "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";

interface LocationMapProps {
  lat: number;
  lng: number;
}

export function LocationMap({ lat, lng }: LocationMapProps) {
  const center = useMemo(() => [lat, lng] as [number, number], [lat, lng]);

  const mapProps = useMemo(() => ({
    center,
    zoom: 15,
    style: { height: "100%", width: "100%" },
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    attributionControl: false,
  } as any), [center]);

  return (
    <MapContainer {...mapProps}>
      <TileLayer url={TILE_URL} />
      <Marker position={center} />
    </MapContainer>
  );
}
