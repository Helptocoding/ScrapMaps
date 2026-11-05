"use client";

import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import {
  MapLibreMap,
  Marker as MapLibreMarker,
  NavigationControl,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type MapMouseEvent,
  type StyleSpecification,
} from "maplibre-gl";

import "maplibre-gl/dist/maplibre-gl.css";

import { cn } from "@/lib/utils";

/**
 * Envoltorio de MapLibre con la API de mapcn (Map / MapMarker / MarkerContent /
 * MarkerTooltip), estilado con los tokens del proyecto.
 *
 * El mapa de exploración usa cartografía pública de OpenStreetMap. Geoapify se
 * reserva para las búsquedas, por lo que el mapa no requiere API key.
 */

const MapContext = createContext<MapLibreMap | null>(null);

type MapProps = {
  center: [number, number];
  zoom?: number;
  bounds?: LngLatBoundsLike;
  className?: string;
  children?: ReactNode;
  onMapReady?: (map: MapLibreMap) => void;
  onMapClick?: (coordinates: { longitude: number; latitude: number }) => void;
};

// CARTO Dark Matter: la misma familia de basemaps de mapcn. La versión raster
// evita que un fallo de fuentes/vector tiles deje el canvas negro.
const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    cartoDarkMatter: {
      type: "raster",
      tiles: ["https://basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "© OpenStreetMap contributors © CARTO",
    },
  },
  layers: [{ id: "carto-dark-matter", type: "raster", source: "cartoDarkMatter" }],
};

export function Map({ center, zoom = 12, bounds, className, children, onMapReady, onMapClick }: MapProps) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [container, setContainer] = useState<HTMLDivElement | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!container) return;

    const instance = new MapLibreMap({
      container,
      style: MAP_STYLE,
      center,
      zoom,
      renderWorldCopies: false,
      attributionControl: { compact: true },
    });

    instance.addControl(new NavigationControl({ showCompass: false }), "top-right");
    instance.on("error", (event) => {
      if (event.error) setFailed(true);
    });
    instance.once("load", () => setMap(instance));

    return () => {
      instance.remove();
      setMap(null);
    };
    // El centro inicial no debe recrear el mapa: los cambios van por fitBounds.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [container]);

  useEffect(() => {
    if (map && onMapReady) onMapReady(map);
  }, [map, onMapReady]);

  useEffect(() => {
    if (!map || !onMapClick) return;

    const handleClick = (event: MapMouseEvent) => {
      onMapClick({ longitude: event.lngLat.lng, latitude: event.lngLat.lat });
    };

    map.on("click", handleClick);
    return () => {
      map.off("click", handleClick);
    };
  }, [map, onMapClick]);

  useEffect(() => {
    if (!map || !bounds) return;
    map.fitBounds(bounds, { padding: 48, maxZoom: 15, duration: 500 });
  }, [map, bounds]);

  return (
    <div className={cn("map-dark relative", className)}>
      <div ref={setContainer} className="size-full" />

      {failed ? (
        <div className="absolute inset-0 flex items-center justify-center bg-canvas/95 p-6 text-center">
          <p className="max-w-[32ch] text-body text-ink-2">
            No se pudo cargar el mapa. Intentá recargar la página.
          </p>
        </div>
      ) : null}

      <MapContext.Provider value={map}>{children}</MapContext.Provider>
    </div>
  );
}

type MapMarkerProps = {
  longitude: number;
  latitude: number;
  children: ReactNode;
};

export function MapMarker({ longitude, latitude, children }: MapMarkerProps) {
  const map = useContext(MapContext);
  const id = useId();
  const element = useMemo(() => {
    if (typeof document === "undefined") return null;
    const node = document.createElement("div");
    node.dataset.markerId = id;
    return node;
  }, [id]);

  useEffect(() => {
    if (!map || !element) return;

    const marker = new MapLibreMarker({ element }).setLngLat([longitude, latitude]).addTo(map);
    return () => {
      marker.remove();
    };
  }, [map, element, longitude, latitude]);

  if (!element) return null;

  return createPortal(children, element);
}

export function MarkerContent({
  className,
  onClick,
  onMouseEnter,
  onMouseLeave,
  children,
}: {
  className?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick?.();
        }
      }}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={cn("group relative flex cursor-pointer items-center justify-center", className)}
    >
      {children}
    </div>
  );
}

export function MarkerTooltip({ open, children }: { open?: boolean; children: ReactNode }) {
  return (
    <div
      role="tooltip"
      className={cn(
        "pointer-events-none absolute bottom-full left-1/2 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-sm bg-ink px-2 py-1 text-small text-canvas shadow-pop transition-opacity",
        open ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
    >
      {children}
    </div>
  );
}

type MapCircleProps = {
  longitude: number;
  latitude: number;
  radiusKm: number;
};

function makeCircle(longitude: number, latitude: number, radiusKm: number) {
  const points = 64;
  const earthRadiusKm = 6371;
  const angularDistance = radiusKm / earthRadiusKm;
  const latitudeRadians = (latitude * Math.PI) / 180;
  const longitudeRadians = (longitude * Math.PI) / 180;
  const coordinates: [number, number][] = [];

  for (let index = 0; index <= points; index += 1) {
    const bearing = (index / points) * Math.PI * 2;
    const circleLatitude = Math.asin(
      Math.sin(latitudeRadians) * Math.cos(angularDistance) +
        Math.cos(latitudeRadians) * Math.sin(angularDistance) * Math.cos(bearing),
    );
    const circleLongitude =
      longitudeRadians +
      Math.atan2(
        Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitudeRadians),
        Math.cos(angularDistance) - Math.sin(latitudeRadians) * Math.sin(circleLatitude),
      );

    coordinates.push([(circleLongitude * 180) / Math.PI, (circleLatitude * 180) / Math.PI]);
  }

  return {
    type: "Feature" as const,
    properties: {},
    geometry: {
      type: "Polygon" as const,
      coordinates: [coordinates],
    },
  };
}

/** Área de búsqueda editable, renderizada como una capa GeoJSON sobre el mapa. */
export function MapCircle({ longitude, latitude, radiusKm }: MapCircleProps) {
  const map = useContext(MapContext);
  const sourceId = "search-radius";
  const fillLayerId = `${sourceId}-fill`;
  const outlineLayerId = `${sourceId}-outline`;
  const circle = useMemo(() => makeCircle(longitude, latitude, radiusKm), [longitude, latitude, radiusKm]);
  const circleRef = useRef(circle);

  useEffect(() => {
    circleRef.current = circle;
  }, [circle]);

  useEffect(() => {
    if (!map) return;

    map.addSource(sourceId, { type: "geojson", data: circleRef.current });
    map.addLayer({
      id: fillLayerId,
      type: "fill",
      source: sourceId,
      paint: { "fill-color": "#f97316", "fill-opacity": 0.32 },
    });
    map.addLayer({
      id: outlineLayerId,
      type: "line",
      source: sourceId,
      paint: { "line-color": "#fed7aa", "line-width": 3, "line-opacity": 1 },
    });

    return () => {
      if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId);
      if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
      if (map.getSource(sourceId)) map.removeSource(sourceId);
    };
  }, [fillLayerId, map, outlineLayerId, sourceId]);

  useEffect(() => {
    if (!map) return;
    const source = map.getSource(sourceId) as GeoJSONSource | undefined;
    source?.setData(circle);
  }, [circle, map, sourceId]);

  return null;
}
