"use client";

import { useEffect, useState } from "react";
import { MapContainer, GeoJSON, TileLayer } from "react-leaflet";
import type { Feature } from "geojson";
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Configurar los íconos por defecto de Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});


export const Mapa = () => {

  const [geoData, setGeoData] = useState(null);

  useEffect(() => {
    fetch('/maps/lima_callao_distritos.geojson')
      .then((response) => response.json())
      .then((data) => setGeoData(data));
  }, []);

  // Datos de ejemplo para el mapa de calor
  // Aquí puedes poner tus propios valores por distrito
  const heatData: Record<string, number> = {
    "SAN BORJA": 80,
    "JESUS MARIA": 68,
    "PACHACAMAC": 30,
    "SAN LUIS": 52,
    "LA MOLINA": 70,
    "ANCON": 25,
    "VILLA EL SALVADOR": 35,
    "SANTIAGO DE SURCO": 75,
    "ATE": 38,
    "CALLAO": 45,
    "LOS OLIVOS": 50,
    "LURIGANCHO": 32,
    "COMAS": 42,
    "VENTANILLA": 40,
    "SANTA ROSA": 28,
    "PUENTE PIEDRA": 38,
    "CARMEN DE LA LEGUA REYNOSO": 48,
    "CIENEGUILLA": 22,
    "PUCUSANA": 20,
    "LINCE": 62,
    "RIMAC": 40,
  };

  // Función para obtener el color según la intensidad (0-100)
  const getColor = (value: number): string => {
    return value > 80 ? '#800026' :  // Rojo oscuro
      value > 70 ? '#BD0026' :  // Rojo
        value > 60 ? '#E31A1C' :  // Rojo claro
          value > 50 ? '#FC4E2A' :  // Naranja rojizo
            value > 40 ? '#FD8D3C' :  // Naranja
              value > 30 ? '#FEB24C' :  // Amarillo anaranjado
                value > 20 ? '#FED976' :  // Amarillo
                  'transparent  ';   // Amarillo claro
  };

  // Función de estilo para cada feature
  const style = (feature: Feature | undefined) => {
    if (!feature) return {};

    // Obtén el nombre del distrito del GeoJSON
    const districtName = feature.properties?.distrito || '';
    const value = heatData[districtName.toUpperCase()] || 0;

    return {
      fillColor: getColor(value),
      weight: 1,
      opacity: 1,
      color: 'white',
      dashArray: '3',
      fillOpacity: 0.7
    };
  };

  // Función para resaltar al pasar el mouse
  const onEachFeature = (feature: Feature, layer: L.Path) => {
    const districtName = feature.properties?.distrito || 'Desconocido';
    const value = heatData[districtName.toUpperCase()] || 0;

    layer.on({
      mouseover: (e: L.LeafletMouseEvent) => {
        const targetLayer = e.target as L.Path;
        targetLayer.setStyle({
          weight: 3,
          color: '#666',
          dashArray: '',
          fillOpacity: 0.9
        });
      },
      mouseout: (e: L.LeafletMouseEvent) => {
        const targetLayer = e.target as L.Path;
        targetLayer.setStyle(style(feature));
      }
    });

    // Popup con información
    layer.bindPopup(`
        <div>
          <strong>${districtName}</strong><br/>
          Valor: ${value}
        </div>
      `);
  };

  if (!geoData) return <div>Loading map...</div>

  return (
    <MapContainer
      center={[-12.0464, -77.0428]}
      zoom={11}
      style={{ height: "600px", width: "100%" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <GeoJSON
        data={geoData}
        style={style}
        onEachFeature={onEachFeature}
      />
    </MapContainer>
  )

}

export default Mapa