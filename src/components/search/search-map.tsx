"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";

import type { LngLatBoundsLike, Map as MapLibreMap } from "maplibre-gl";

import { Map, MapCircle, MapMarker, MarkerContent, MarkerTooltip } from "@/components/map/map";
import { cn } from "@/lib/utils";
import type { MapBusinessPoint } from "@/types/app";

type SearchMapProps = {
  businesses: MapBusinessPoint[];
  selectedId: string | null;
  hoveredId: string | null;
  onSelect: (placeId: string | null) => void;
  onHover: (placeId: string | null) => void;
  selectedLocation?: { lat: number; lon: number } | null;
  radiusKm?: number;
  onLocationSelect?: (coordinates: { lat: number; lon: number }) => void;
};

/** Mantiene el DOM del mapa ligero; al acercarse se muestran más puntos reales. */
const MAX_PINS = 72;

type DisplayMarker =
  | { kind: "business"; business: MapBusinessPoint }
  | { kind: "cluster"; id: string; lat: number; lon: number; count: number };

function buildDisplayMarkers(pins: MapBusinessPoint[], zoom: number): DisplayMarker[] {
  if (zoom >= 13) return pins.map((business) => ({ kind: "business", business }));

  const cellSize = zoom < 10 ? 0.18 : zoom < 12 ? 0.06 : 0.025;
  const groups = new globalThis.Map<string, MapBusinessPoint[]>();

  for (const pin of pins) {
    const key = `${Math.floor(pin.lat / cellSize)}:${Math.floor(pin.lon / cellSize)}`;
    const group = groups.get(key) ?? [];
    group.push(pin);
    groups.set(key, group);
  }

  return Array.from(groups.entries()).map(([id, group]) => {
    if (group.length === 1) return { kind: "business", business: group[0] };
    return {
      kind: "cluster",
      id,
      lat: group.reduce((sum, pin) => sum + pin.lat, 0) / group.length,
      lon: group.reduce((sum, pin) => sum + pin.lon, 0) / group.length,
      count: group.length,
    };
  });
}

export const SearchMap = memo(function SearchMap({
  businesses,
  selectedId,
  hoveredId,
  onSelect,
  onHover,
  selectedLocation = null,
  radiusKm = 5,
  onLocationSelect,
}: SearchMapProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [zoom, setZoom] = useState(10);
  const handleMapReady = useCallback((instance: MapLibreMap) => {
    setMap(instance);
    setZoom(instance.getZoom());
  }, []);

  const pins = useMemo(
    () =>
      businesses
        .filter((business) => Number.isFinite(business.lat) && Number.isFinite(business.lon))
        .slice(0, MAX_PINS),
    [businesses],
  );

  const bounds = useMemo<LngLatBoundsLike | undefined>(() => {
    if (pins.length === 0) return undefined;

    const lats = pins.map((pin) => pin.lat);
    const lons = pins.map((pin) => pin.lon);

    return [
      [Math.min(...lons), Math.min(...lats)],
      [Math.max(...lons), Math.max(...lats)],
    ];
  }, [pins]);

  const center = useMemo<[number, number]>(() => {
    if (selectedLocation) return [selectedLocation.lon, selectedLocation.lat];
    if (pins.length === 0) return [-100.3161, 25.6866];
    return [
      pins.reduce((sum, pin) => sum + pin.lon, 0) / pins.length,
      pins.reduce((sum, pin) => sum + pin.lat, 0) / pins.length,
    ];
  }, [pins, selectedLocation]);

  const markers = useMemo(() => buildDisplayMarkers(pins, zoom), [pins, zoom]);

  useEffect(() => {
    if (!map) return;
    const handleZoom = () => setZoom(map.getZoom());
    map.on("zoomend", handleZoom);
    return () => {
      map.off("zoomend", handleZoom);
    };
  }, [map]);

  // Seleccionar una fila de la tabla vuela el mapa a ese negocio.
  useEffect(() => {
    if (!map || !selectedId) return;
    const target = pins.find((pin) => pin.placeId === selectedId);
    if (!target) return;

    map.flyTo({ center: [target.lon, target.lat], zoom: Math.max(map.getZoom(), 15), duration: 600 });
  }, [map, selectedId, pins]);

  useEffect(() => {
    if (!map || !selectedLocation) return;
    map.flyTo({ center: [selectedLocation.lon, selectedLocation.lat], zoom: Math.max(map.getZoom(), 12), duration: 500 });
  }, [map, selectedLocation]);

  return (
    <Map
      center={center}
      bounds={bounds}
      zoom={12}
      className="h-full w-full"
      onMapReady={handleMapReady}
      onMapClick={onLocationSelect ? ({ longitude, latitude }) => onLocationSelect({ lon: longitude, lat: latitude }) : undefined}
    >
      {selectedLocation ? (
        <>
          <MapCircle longitude={selectedLocation.lon} latitude={selectedLocation.lat} radiusKm={radiusKm} />
          <MapMarker longitude={selectedLocation.lon} latitude={selectedLocation.lat}>
            <MarkerContent className="pointer-events-none">
              <span className="animate-breathe block size-6 rounded-full border-2 border-white bg-orange-500 shadow-[0_2px_14px_rgba(234,88,12,0.75)] ring-4 ring-orange-200/50" />
            </MarkerContent>
          </MapMarker>
        </>
      ) : null}
      {markers.map((marker) => {
        if (marker.kind === "cluster") {
          return (
            <MapMarker key={`cluster-${marker.id}`} longitude={marker.lon} latitude={marker.lat}>
              <MarkerContent
                onClick={() => map?.flyTo({ center: [marker.lon, marker.lat], zoom: Math.min(zoom + 2, 15), duration: 450 })}
                className="size-8 rounded-full border-2 border-white bg-zinc-950 text-xs font-semibold text-white shadow-[0_2px_10px_rgba(15,23,42,0.35)]"
              >
                {marker.count}
              </MarkerContent>
            </MapMarker>
          );
        }

        const { business } = marker;
        const isOpportunity = !business.website;
        const isSelected = business.placeId === selectedId;
        const isHovered = business.placeId === hoveredId;

        return (
          <MapMarker key={business.placeId} longitude={business.lon} latitude={business.lat}>
            <MarkerContent
              onClick={() => onSelect(isSelected ? null : business.placeId)}
              onMouseEnter={() => onHover(business.placeId)}
              onMouseLeave={() => onHover(null)}
            >
              <span
                className={cn(
                  "block rounded-full border-2 border-white bg-blue-500 shadow-[0_2px_8px_rgba(37,99,235,0.55)] transition-all",
                  isSelected || isHovered ? "size-6 scale-110" : "size-5",
                  isSelected ? "ring-2 ring-blue-300 ring-offset-2 ring-offset-[#111315]" : "",
                )}
              />
              <MarkerTooltip open={isSelected || isHovered}>
                {business.name}
                {isOpportunity ? " · sin web" : ""}
              </MarkerTooltip>
            </MarkerContent>
          </MapMarker>
        );
      })}
    </Map>
  );
});
