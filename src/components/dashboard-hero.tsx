"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useRef, useState } from "react";
import { ArrowRightIcon, SparklesIcon } from "lucide-react";

import type { MapBusinessPoint } from "@/types/app";

const SearchMap = dynamic(() => import("@/components/search/search-map").then((mod) => mod.SearchMap), {
  ssr: false,
  loading: () => <div className="size-full animate-pulse bg-[#dfe7ea]" aria-label="Cargando mapa" />,
});

const noopSelect = (_placeId: string | null) => undefined;
const noopHover = (_placeId: string | null) => undefined;

type DashboardHeroProps = {
  businesses: MapBusinessPoint[];
  businessCount: number;
  noWebsiteCount: number;
  zoneCount: number;
  selectedLocation: { lat: number; lon: number } | null;
  radiusKm: string;
  onLocationSelect: (coordinates: { lat: number; lon: number }) => void;
  onMapVisible: () => void;
};

export const DashboardHero = memo(function DashboardHero({
  businesses,
  businessCount,
  noWebsiteCount,
  zoneCount,
  selectedLocation,
  radiusKm,
  onLocationSelect,
  onMapVisible,
}: DashboardHeroProps) {
  const mapViewportRef = useRef<HTMLDivElement>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const target = mapViewportRef.current;
    if (!target) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        setMapReady(true);
        observer.disconnect();
      },
      { rootMargin: "180px" },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (mapReady) onMapVisible();
  }, [mapReady, onMapVisible]);

  return (
    <section className="overflow-hidden border-b border-black/[0.06] bg-white px-4 py-8 sm:px-6 sm:py-12 lg:px-10 lg:py-16">
      <div className="mx-auto grid max-w-[1380px] items-center gap-10 lg:grid-cols-[0.88fr_1.12fr] lg:gap-16">
        <div className="max-w-xl">
          <div className="animate-reveal inline-flex items-center gap-2 rounded-full border border-black/[0.08] bg-[#f5f5f7] px-3 py-1.5 text-[11px] font-semibold tracking-[0.12em] text-zinc-600">
            <SparklesIcon size={13} className="text-blue-600" aria-hidden="true" />
            PROSPECCIÓN INTELIGENTE
          </div>
          <h1 className="animate-reveal delay-1 mt-5 text-5xl font-semibold leading-[0.98] tracking-[-0.065em] text-zinc-950 sm:text-6xl lg:text-7xl">
            Tu próximo cliente ya está cerca.
          </h1>
          <p className="animate-reveal delay-2 mt-6 max-w-[47ch] text-base leading-7 text-zinc-600 sm:text-lg">
            Descubrí negocios locales, identificá oportunidades sin presencia web y pasá de un mapa a una conversación real.
          </p>
          <a href="#oportunidades" className="animate-reveal delay-3 pressable mt-8 inline-flex items-center gap-2 rounded-full bg-zinc-950 px-5 py-3 text-sm font-semibold text-white hover:bg-zinc-800">
            Ver oportunidades
            <ArrowRightIcon size={16} aria-hidden="true" />
          </a>

          <div className="animate-reveal delay-3 mt-10 grid grid-cols-3 gap-3 border-t border-black/[0.08] pt-5">
            <Metric value={businessCount} label="negocios" />
            <Metric value={noWebsiteCount} label="sin web" highlighted />
            <Metric value={zoneCount} label="zonas" />
          </div>
        </div>

        <div ref={mapViewportRef} className="animate-scale-in delay-2 relative h-[380px] overflow-hidden rounded-[32px] border border-black/[0.08] bg-[#e7edf0] shadow-[0_24px_70px_rgba(15,23,42,0.13)] sm:h-[480px]">
          {mapReady ? (
            <SearchMap
              businesses={businesses}
              selectedId={null}
              hoveredId={null}
              onSelect={noopSelect}
              onHover={noopHover}
              selectedLocation={selectedLocation}
              radiusKm={Number(radiusKm)}
              onLocationSelect={onLocationSelect}
            />
          ) : (
            <div className="size-full bg-[linear-gradient(120deg,#e7edf0,#f4f7f7,#e7edf0)]" aria-label="Mapa listo para cargar" />
          )}
          <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(130deg,rgba(255,255,255,0.18),transparent_40%,rgba(15,23,42,0.12))]" />
          <div className="pointer-events-none absolute left-5 top-5 rounded-2xl border border-white/60 bg-white/80 px-4 py-3 shadow-[0_10px_30px_rgba(15,23,42,0.12)] backdrop-blur-xl">
            <p className="text-[10px] font-semibold uppercase tracking-[0.13em] text-zinc-500">Zona de búsqueda</p>
            <p className="mt-1 text-sm font-semibold tracking-[-0.02em] text-zinc-900">
              {selectedLocation ? `Radio de ${radiusKm} km` : "Hacé clic para elegir un punto"}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
});

function Metric({ value, label, highlighted = false }: { value: number; label: string; highlighted?: boolean }) {
  return (
    <div>
      <div className={highlighted ? "text-2xl font-semibold tracking-[-0.045em] text-orange-600" : "text-2xl font-semibold tracking-[-0.045em] text-zinc-950"}>{value}</div>
      <div className="mt-0.5 text-xs font-medium text-zinc-500">{label}</div>
    </div>
  );
}
