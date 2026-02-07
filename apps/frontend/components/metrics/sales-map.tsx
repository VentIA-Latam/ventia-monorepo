"use client";

import { useEffect, useMemo, useState } from "react";
import { MapContainer, GeoJSON, TileLayer } from "react-leaflet";
import type { Feature, FeatureCollection } from "geojson";
import type { PathOptions } from "leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Configurar los íconos por defecto de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

interface CityData {
  city: string;
  order_count: number;
}

interface SalesMapProps {
  data: CityData[];
}

// Tonal scale: slate-blue low → warm amber high (matches operations feel)
const COLOR_SCALE = [
  { threshold: 0.9, color: "oklch(0.55 0.20 30)", label: "Muy alto" },
  { threshold: 0.75, color: "oklch(0.62 0.18 40)", label: "Alto" },
  { threshold: 0.6, color: "oklch(0.70 0.16 55)", label: "Medio-alto" },
  { threshold: 0.45, color: "oklch(0.78 0.14 75)", label: "Medio" },
  { threshold: 0.3, color: "oklch(0.82 0.10 170)", label: "Medio-bajo" },
  { threshold: 0.15, color: "oklch(0.86 0.08 210)", label: "Bajo" },
  { threshold: 0, color: "oklch(0.92 0.04 240)", label: "Muy bajo" },
];

export const SalesMap = ({ data }: SalesMapProps) => {
  const [geoData, setGeoData] = useState<FeatureCollection | null>(null);

  useEffect(() => {
    fetch("/maps/lima_callao_distritos.geojson")
      .then((response) => response.json())
      .then((data) => setGeoData(data));
  }, []);

  const heatData: Record<string, number> = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of data) {
      map[item.city.toUpperCase()] = item.order_count;
    }
    return map;
  }, [data]);

  // Key that changes when data changes — forces GeoJSON layer to remount.
  // react-leaflet's <GeoJSON> doesn't re-render on prop changes, so without
  // this, styles and popups become stale after a filter change.
  const geoJsonKey = useMemo(() => {
    return JSON.stringify(heatData);
  }, [heatData]);

  const maxValue = useMemo(() => {
    return Math.max(...data.map((d) => d.order_count), 1);
  }, [data]);

  const getColor = (value: number): string => {
    if (value === 0) return "transparent";
    const ratio = value / maxValue;
    for (const { threshold, color } of COLOR_SCALE) {
      if (ratio > threshold) return color;
    }
    return COLOR_SCALE[COLOR_SCALE.length - 1].color;
  };

  const legendItems = useMemo(() => {
    return [...COLOR_SCALE];
  }, []);

  const getStyle = (feature: Feature | undefined): PathOptions => {
    if (!feature) return {};

    const districtName = (feature.properties?.distrito as string) || "";
    const value = heatData[districtName.toUpperCase()] || 0;

    return {
      fillColor: getColor(value),
      weight: 1,
      opacity: 1,
      color: "oklch(0.922 0 0)",
      dashArray: "",
      fillOpacity: 0.75,
    };
  };

  const onEachFeature = (feature: Feature, layer: L.Layer) => {
    const districtName = (feature.properties?.distrito as string) || "Desconocido";
    const value = heatData[districtName.toUpperCase()] || 0;

    const pathLayer = layer as L.Path;

    pathLayer.on({
      mouseover: (e: L.LeafletMouseEvent) => {
        const target = e.target as L.Path;
        target.setStyle({
          weight: 2,
          color: "oklch(0.4 0 0)",
          dashArray: "",
          fillOpacity: 0.9,
        });
      },
      mouseout: (e: L.LeafletMouseEvent) => {
        const target = e.target as L.Path;
        target.setStyle(getStyle(feature));
      },
    });

    pathLayer.bindPopup(`
      <div style="font-family: system-ui, sans-serif; font-size: 13px; line-height: 1.4;">
        <strong>${districtName}</strong><br/>
        Pedidos: <span style="font-variant-numeric: tabular-nums; font-weight: 600;">${value}</span>
      </div>
    `);
  };

  if (!geoData) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
        Cargando mapa...
      </div>
    );
  }

  // react-leaflet v5 + pnpm + @types/leaflet has type resolution issues.
  // The props are correct at runtime — cast to satisfy the compiler.
  const mapProps = {
    center: [-12.0464, -77.0428] as [number, number],
    zoom: 11,
    style: { height: "100%", width: "100%" },
    className: "rounded-lg",
  } as any;

  const tileProps = {
    attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>',
    url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  } as any;

  const geoJsonProps = {
    data: geoData,
    style: getStyle,
    onEachFeature,
  } as any;

  return (
    <div className="relative h-full">
      <MapContainer {...mapProps}>
        <TileLayer {...tileProps} />
        <GeoJSON key={geoJsonKey} {...geoJsonProps} />
      </MapContainer>

      {/* Legend */}
      <div className="absolute bottom-6 right-3 z-[1000] rounded-lg border bg-card/95 backdrop-blur-sm p-3 text-xs shadow-md">
        <div className="font-semibold mb-1.5 text-foreground">Pedidos</div>
        <div className="space-y-1">
          {legendItems.map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className="inline-block w-4 h-3 rounded-sm border border-border/50"
                style={{ backgroundColor: item.color }}
              />
              <span className="text-muted-foreground">{item.label}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 mt-0.5">
            <span className="inline-block w-4 h-3 rounded-sm border border-border/50 bg-muted" />
            <span className="text-muted-foreground">Sin pedidos</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SalesMap;
