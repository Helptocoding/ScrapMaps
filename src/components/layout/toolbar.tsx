"use client";

import { ChevronDownIcon, KeyRoundIcon, MapPinIcon, SearchIcon, Settings2Icon } from "lucide-react";

import { Combobox, type ComboboxOption } from "@/components/search/combobox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { CategoryOption } from "@/types/app";

type ToolbarProps = {
  queryText: string;
  locationQuery: string;
  radiusKm: string;
  radiusOptions: ComboboxOption[];
  provider: string;
  providerOptions: ComboboxOption[];
  categories: CategoryOption[];
  apiKeyConfigured: boolean;
  isPending: boolean;
  onQueryTextChange: (value: string) => void;
  onLocationQueryChange: (value: string) => void;
  onRadiusChange: (value: string) => void;
  onProviderChange: (value: string) => void;
  onSearch: () => void;
  onApproximate: () => void;
  onForceRefresh: () => void;
  onOpenSettings: () => void;
};

const ICON_BUTTON =
  "pressable relative inline-flex size-8 items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950";

/**
 * La búsqueda vive en el chrome de la app, no en un hero.
 *
 * En una herramienta densa el formulario no es el destino: es el control que
 * usás mil veces sin dejar de mirar la tabla. Por eso ocupa 52px fijos arriba
 * y nunca empuja el contenido.
 */
export function Toolbar({
  queryText,
  locationQuery,
  radiusKm,
  radiusOptions,
  provider,
  providerOptions,
  categories,
  apiKeyConfigured,
  isPending,
  onQueryTextChange,
  onLocationQueryChange,
  onRadiusChange,
  onProviderChange,
  onSearch,
  onApproximate,
  onForceRefresh,
  onOpenSettings,
}: ToolbarProps) {
  const fieldsReady = Boolean(queryText.trim()) && Boolean(locationQuery.trim());
  const canSearch = apiKeyConfigured && fieldsReady && !isPending;

  const categoryOptions = categories.map((category) => ({
    value: category.label,
    label: category.label,
    searchable: `${category.label} ${category.aliases.join(" ")}`,
  }));

  return (
    <header className="mx-auto flex h-toolbar w-full max-w-[1380px] shrink-0 items-center gap-1 px-4 sm:px-6 lg:px-10">
      <div className="flex items-center gap-2 pr-3">
        <span className="inline-flex size-7 items-center justify-center rounded-full bg-zinc-950 text-white shadow-sm">
          <MapPinIcon size={12} />
        </span>
        <span className="text-sm font-semibold tracking-[-0.03em] text-zinc-950">Prospect</span>
      </div>

      <span className="mx-1 h-5 w-px bg-zinc-200" aria-hidden="true" />

      {/* Campos de búsqueda inline */}
      <div className="flex min-w-0 flex-1 items-center gap-1">
        <div className="min-w-0 flex-1 wide:max-w-[220px]">
          <Combobox
            variant="toolbar"
            label="Rubro"
            value={queryText}
            options={categoryOptions}
            onChange={onQueryTextChange}
            placeholder="Rubro…"
          />
        </div>

        <label className="flex h-7 min-w-0 flex-1 items-center gap-1.5 rounded border border-transparent px-2 transition-colors hover:bg-panel-2 focus-within:border-line-strong focus-within:bg-panel-2 wide:max-w-[240px]">
          <SearchIcon size={13} className="shrink-0 text-ink-3" aria-hidden="true" />
          <input
            value={locationQuery}
            onChange={(event) => onLocationQueryChange(event.target.value)}
            placeholder="Ubicación…"
            aria-label="Ubicación"
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-3"
          />
        </label>

        <div className="w-[84px] shrink-0">
          <Combobox
            variant="toolbar"
            label="Radio"
            value={radiusKm}
            options={radiusOptions}
            onChange={onRadiusChange}
          />
        </div>

        <div className="w-[128px] shrink-0">
          <Combobox
            variant="toolbar"
            label="Fuente"
            value={provider}
            options={providerOptions}
            onChange={onProviderChange}
          />
        </div>

        {/* Acción primaria: el único fondo sólido de toda la toolbar. */}
        <div className="flex shrink-0 items-center">
          {apiKeyConfigured ? (
            <>
              <button
                type="button"
                onClick={onSearch}
                disabled={!canSearch}
                className="pressable inline-flex h-7 items-center gap-1.5 rounded-l bg-accent px-3 text-body font-medium text-accent-foreground hover:bg-accent-hover disabled:bg-panel-2 disabled:text-ink-3"
              >
                {isPending ? "Buscando…" : "Buscar"}
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    disabled={!canSearch}
                    aria-label="Más opciones de búsqueda"
                    className="inline-flex h-7 items-center rounded-r border-l border-accent-hover/40 bg-accent px-1.5 text-accent-foreground transition-colors hover:bg-accent-hover disabled:border-line disabled:bg-panel-2 disabled:text-ink-3"
                  >
                    <ChevronDownIcon size={13} />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" sideOffset={4} className="w-56 p-1">
                  <button
                    type="button"
                    onClick={onForceRefresh}
                    className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-panel-2"
                  >
                    <span className="text-body text-ink">Buscar sin caché</span>
                    <span className="text-small text-ink-3">Ignora resultados guardados</span>
                  </button>
                  <button
                    type="button"
                    onClick={onApproximate}
                    className="flex w-full flex-col items-start rounded-sm px-2 py-1.5 text-left transition-colors hover:bg-panel-2"
                  >
                    <span className="text-body text-ink">Coincidencia aproximada</span>
                    <span className="text-small text-ink-3">Si el rubro no está en el diccionario</span>
                  </button>
                </PopoverContent>
              </Popover>
            </>
          ) : (
            // Sin key nada funciona: el botón no se apaga, señala el paso que falta.
            <button
              type="button"
              onClick={onOpenSettings}
              className="pressable inline-flex h-7 items-center gap-1.5 rounded bg-accent px-3 text-body font-medium text-accent-foreground hover:bg-accent-hover"
            >
              <KeyRoundIcon size={12} />
              Configurar API key
            </button>
          )}
        </div>
      </div>

      <span className="mx-1 h-5 w-px bg-line" aria-hidden="true" />

      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={onOpenSettings}
          aria-label="Abrir configuración"
          title="Configuración"
          className={ICON_BUTTON}
        >
          <Settings2Icon size={15} />
          {!apiKeyConfigured ? (
            <span
              className="absolute right-1 top-1 size-1.5 rounded-full bg-signal ring-2 ring-panel"
              aria-hidden="true"
            />
          ) : null}
        </button>
      </div>
    </header>
  );
}
