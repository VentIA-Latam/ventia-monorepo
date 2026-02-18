"use client";

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

interface LocationMapProps {
  lat: number;
  lng: number;
}

export function LocationMap({ lat, lng }: LocationMapProps) {
  const mapProps = {
    center: [lat, lng] as [number, number],
    zoom: 15,
    style: { height: "100%", width: "100%" },
    zoomControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    attributionControl: false,
  } as any;

  const tileProps = {
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  } as any;

  const markerProps = {
    position: [lat, lng] as [number, number],
  } as any;

  return (
    <MapContainer {...mapProps}>
      <TileLayer {...tileProps} />
      <Marker {...markerProps} />
    </MapContainer>
  );
}
