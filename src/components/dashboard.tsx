"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";

import dynamic from "next/dynamic";
import {
  ArrowDownIcon,
  CheckCircle2Icon,
  DownloadIcon,
  LoaderCircleIcon,
  MapPinIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import { BusinessTable } from "@/components/business-table";
import { Combobox, type ComboboxOption } from "@/components/search/combobox";
import { FormattedDate } from "@/components/formatted-date";
import { Toolbar } from "@/components/layout/toolbar";
import { Chip, MicroLabel, Tag } from "@/components/ui/tag";
import { cn } from "@/lib/utils";
import type {
  ApiUsageSummary,
  BusinessPage,
  BusinessRecord,
  CategoryOption,
  CategoryResolution,
  LocationCandidate,
  MapBusinessPoint,
  SearchProvider,
  SearchRunResponse,
  SearchSummary as SearchSummaryRecord,
} from "@/types/app";

type FilterOption = {
  primaryCategory: string;
  categoryLabel: string | null;
};

type SearchFilterOption = {
  id: string;
  locationLabel: string;
  executedAt: string;
};

type ApiProvider = "geoapify" | "googlePlaces" | "foursquare";
type ApiKeyConfiguration = Record<ApiProvider, boolean>;

type DashboardProps = {
  categories: CategoryOption[];
  initialBusinesses: BusinessRecord[];
  initialPagination: Pick<BusinessPage, "total" | "noWebsiteCount" | "page" | "pageSize">;
  initialSearches: SearchSummaryRecord[];
  initialCategoryFilters: FilterOption[];
  initialSearchFilters: SearchFilterOption[];
  initialApiKeyConfiguration: ApiKeyConfiguration;
  initialApiUsage: ApiUsageSummary[];
  cacheTtlDays: number;
};

type FilterState = {
  hasWebsite: "all" | "yes" | "no";
  category: string;
  searchId: string;
  query: string;
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completada",
  REUSED: "Reutilizada",
  FAILED: "Fallida",
};

const API_PROVIDERS: Array<{
  id: ApiProvider;
  name: string;
  description: string;
  active: boolean;
}> = [
  { id: "geoapify", name: "Geoapify", description: "Descubrimiento por radio y categorías", active: true },
  { id: "googlePlaces", name: "Google Places", description: "Datos comerciales, teléfonos y reseñas", active: true },
  { id: "foursquare", name: "Foursquare", description: "POIs y enriquecimiento adicional", active: false },
];

/**
 * MapLibre toca `window` al importarse y pesa: se carga cuando el panel del
 * mapa está abierto, no en el arranque.
 */
const DashboardHero = dynamic(() => import("@/components/dashboard-hero").then((mod) => mod.DashboardHero), {
  ssr: false,
  loading: () => <div className="h-[min(390px,42vh)] min-h-[280px] shrink-0 animate-pulse bg-panel-2" />,
});

async function readJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, init);
  const body = await response.text();
  let payload: (T & { error?: string }) | null = null;

  try {
    payload = JSON.parse(body) as T & { error?: string };
  } catch {
    const target = typeof input === "string" ? input : input.toString();
    const kind = body.trimStart().startsWith("<!DOCTYPE") ? "una página HTML de error" : "una respuesta inválida";
    throw new Error(`${target} devolvió ${kind} (HTTP ${response.status}). Revisá el error del servidor y volvé a intentar.`);
  }

  if (!response.ok) {
    throw new Error(payload.error ?? "La operación no pudo completarse.");
  }

  return payload;
}

export function Dashboard({
  categories,
  initialBusinesses,
  initialPagination,
  initialSearches,
  initialCategoryFilters,
  initialSearchFilters,
  initialApiKeyConfiguration,
  initialApiUsage,
  cacheTtlDays,
}: DashboardProps) {
  const [apiKey, setApiKey] = useState("");
  const [configuredApiKeys, setConfiguredApiKeys] = useState(initialApiKeyConfiguration);
  const [apiUsage, setApiUsage] = useState(initialApiUsage);
  const [selectedApiProvider, setSelectedApiProvider] = useState<ApiProvider>("geoapify");
  const [searchProvider, setSearchProvider] = useState<SearchProvider>(
    initialApiKeyConfiguration.googlePlaces ? "GOOGLE" : "GEOAPIFY",
  );
  const [apiKeyMessage, setApiKeyMessage] = useState<string | null>(null);
  const [apiPanelOpen, setApiPanelOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"sources" | "usage" | "history">("sources");
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const locationConfirmOpenRef = useRef<HTMLButtonElement>(null);

  const [queryText, setQueryText] = useState("");
  const [locationQuery, setLocationQuery] = useState("");
  const [radiusKm, setRadiusKm] = useState("5");
  const [selectedMapLocation, setSelectedMapLocation] = useState<LocationCandidate | null>(null);
  const [tableFilter, setTableFilter] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [mapBusinesses, setMapBusinesses] = useState<MapBusinessPoint[]>([]);
  const [pagination, setPagination] = useState(initialPagination);
  const [searchHistory, setSearchHistory] = useState(initialSearches);
  const [categoryFilters, setCategoryFilters] = useState(initialCategoryFilters);
  const [searchFilters, setSearchFilters] = useState(initialSearchFilters);
  const [filters, setFilters] = useState<FilterState>({ hasWebsite: "all", category: "", searchId: "", query: "" });
  const [categoryResolution, setCategoryResolution] = useState<CategoryResolution | null>(null);
  const [pendingMode, setPendingMode] = useState<"CATEGORY" | "NAME_FALLBACK" | null>(null);
  const [locationCandidates, setLocationCandidates] = useState<LocationCandidate[]>([]);
  const [summary, setSummary] = useState<SearchRunResponse | null>(null);
  const [latestSearchId, setLatestSearchId] = useState<string | null>(null);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [searchPhase, setSearchPhase] = useState<"idle" | "resolving" | "running">("idle");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const forceRefreshRef = useRef(false);
  const apiKeyConfigured = searchProvider === "GOOGLE" ? configuredApiKeys.googlePlaces : configuredApiKeys.geoapify;
  const selectedProvider = API_PROVIDERS.find((provider) => provider.id === selectedApiProvider)!;

  function handleForceRefresh() {
    forceRefreshRef.current = true;
    resolveSearch("CATEGORY");
  }

  function handleLocationQueryChange(value: string) {
    setLocationQuery(value);
    setSelectedMapLocation(null);
  }

  const handleMapLocationSelect = useCallback(({ lat, lon }: { lat: number; lon: number }) => {
    const label = `Punto seleccionado (${lat.toFixed(4)}, ${lon.toFixed(4)})`;
    setSelectedMapLocation({
      placeId: null,
      label,
      lat,
      lon,
      resultType: "selected_point",
      confidence: 1,
    });
    setLocationQuery(label);
    setLocationCandidates([]);
    setSearchMessage(`Zona seleccionada. La búsqueda usará un radio de ${radiusKm} km alrededor de este punto.`);
  }, [radiusKm]);

  function scrollToResults() {
    document.getElementById("oportunidades")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const noWebsiteCount = pagination.noWebsiteCount;
  const businessCount = pagination.total;
  const zoneCount = searchFilters.length;

  const exportQuery = useMemo(() => {
    const params = new URLSearchParams();
    params.set("hasWebsite", filters.hasWebsite);
    if (filters.category) params.set("category", filters.category);
    if (filters.searchId) params.set("searchId", filters.searchId);
    if (filters.query) params.set("query", filters.query);
    return params.toString();
  }, [filters]);

  const websiteOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "all", label: "Todos" },
      { value: "no", label: "Sin sitio web" },
      { value: "yes", label: "Con sitio web" },
    ],
    [],
  );

  const categoryOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "", label: "Todas las categorías" },
      ...categoryFilters.map((category) => ({
        value: category.primaryCategory,
        label: category.categoryLabel ?? category.primaryCategory,
      })),
    ],
    [categoryFilters],
  );

  const searchOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "", label: "Todas las zonas" },
      ...searchFilters.map((search) => ({
        value: search.id,
        label: search.locationLabel,
        searchable: search.locationLabel,
      })),
    ],
    [searchFilters],
  );

  const radiusOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "2", label: "2 km" },
      { value: "5", label: "5 km" },
      { value: "10", label: "10 km" },
      { value: "15", label: "15 km" },
      { value: "20", label: "20 km" },
    ],
    [],
  );

  const providerOptions = useMemo<ComboboxOption[]>(
    () => [
      { value: "GOOGLE", label: "Google Places" },
      { value: "GEOAPIFY", label: "Geoapify" },
    ],
    [],
  );

  useEffect(() => {
    if (!apiPanelOpen) return;
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setApiPanelOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [apiPanelOpen]);

  const locationConfirmOpen = locationCandidates.length > 0;

  useEffect(() => {
    if (!locationConfirmOpen) return;
    locationConfirmOpenRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setLocationCandidates([]);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [locationConfirmOpen]);

  const refreshMapBusinesses = useCallback(async (nextFilters: FilterState) => {
    const params = new URLSearchParams();
    params.set("hasWebsite", nextFilters.hasWebsite);
    if (nextFilters.category) params.set("category", nextFilters.category);
    if (nextFilters.searchId) params.set("searchId", nextFilters.searchId);
    if (nextFilters.query) params.set("query", nextFilters.query);

    const payload = await readJson<{ businesses: MapBusinessPoint[] }>(`/api/map/points?${params.toString()}`);
    setMapBusinesses(payload.businesses);
  }, []);

  const handleMapVisible = useCallback(() => {
    refreshMapBusinesses(filters).catch((error: Error) => setErrorMessage(error.message));
  }, [filters, refreshMapBusinesses]);

  async function refreshBusinesses(nextFilters: FilterState, page = 1) {
    const params = new URLSearchParams();
    params.set("hasWebsite", nextFilters.hasWebsite);
    if (nextFilters.category) params.set("category", nextFilters.category);
    if (nextFilters.searchId) params.set("searchId", nextFilters.searchId);
    if (nextFilters.query) params.set("query", nextFilters.query);
    params.set("page", String(page));
    params.set("pageSize", String(pagination.pageSize));

    const payload = await readJson<{
      businesses: BusinessRecord[];
      total: number;
      noWebsiteCount: number;
      page: number;
      pageSize: number;
      categories: FilterOption[];
      searches: SearchFilterOption[];
    }>(`/api/businesses?${params.toString()}`);

    setBusinesses(payload.businesses);
    setPagination({
      total: payload.total,
      noWebsiteCount: payload.noWebsiteCount,
      page: payload.page,
      pageSize: payload.pageSize,
    });
    setCategoryFilters(payload.categories);
    setSearchFilters(payload.searches);
  }

  function updateFilter(partial: Partial<FilterState>) {
    const next = { ...filters, ...partial };
    setFilters(next);
    setSelectedId(null);
    setIsRefreshing(true);

    startTransition(() => {
      refreshBusinesses(next)
        .catch((error: Error) => setErrorMessage(error.message))
        .finally(() => setIsRefreshing(false));
    });
  }

  function changePage(page: number) {
    if (page === pagination.page || page < 1) return;
    setSelectedId(null);
    setIsRefreshing(true);

    startTransition(() => {
      refreshBusinesses(filters, page)
        .catch((error: Error) => setErrorMessage(error.message))
        .finally(() => setIsRefreshing(false));
    });
  }

  useEffect(() => {
    const nextQuery = tableFilter.trim();
    if (nextQuery === filters.query) return;

    const timeout = window.setTimeout(() => updateFilter({ query: nextQuery }), 300);
    return () => window.clearTimeout(timeout);
  }, [tableFilter, filters.query]);

  async function saveApiKey() {
    setApiKeyMessage(null);
    setErrorMessage(null);

    try {
      const payload = await readJson<{ message: string }>("/api/session/api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedApiProvider, apiKey }),
      });

      setConfiguredApiKeys((current) => ({ ...current, [selectedApiProvider]: true }));
      setApiKey("");
      setApiKeyMessage(payload.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo guardar la API key.");
    }
  }

  async function clearApiKey() {
    setApiKeyMessage(null);
    setErrorMessage(null);

    try {
      const payload = await readJson<{ message: string }>("/api/session/api-key", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: selectedApiProvider }),
      });
      setConfiguredApiKeys((current) => ({ ...current, [selectedApiProvider]: false }));
      setApiKeyMessage(payload.message);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo eliminar la API key.");
    }
  }

  async function resolveSearch(mode: "CATEGORY" | "NAME_FALLBACK") {
    setErrorMessage(null);
    setSearchMessage(null);
    setLocationCandidates([]);
    setSummary(null);
    setPendingMode(mode);
    setSearchPhase("resolving");

    try {
      const categoryPayload = await readJson<CategoryResolution>("/api/search/resolve-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryTextOriginal: queryText }),
      });

      setCategoryResolution(categoryPayload);

      if (!categoryPayload.matched && mode === "CATEGORY") {
        setSearchMessage("No encontramos un rubro exacto. Elegí una sugerencia o usá coincidencia aproximada.");
        return;
      }

      if (selectedMapLocation) {
        await runSearch(selectedMapLocation, false, {
          mode,
          queryCategory: categoryPayload.match?.geoapifyCategory ?? null,
        });
        return;
      }

      const locationPayload = await readJson<{ candidates: LocationCandidate[] }>("/api/search/resolve-location", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locationQuery, provider: searchProvider }),
      });

      if (locationPayload.candidates.length === 0) {
        setSearchMessage("No se encontró una ubicación clara. Ajustá el texto de la zona.");
        return;
      }

      setLocationCandidates(locationPayload.candidates);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "No se pudo preparar la búsqueda.");
    } finally {
      setSearchPhase("idle");
    }
  }

  async function runSearch(
    candidate: LocationCandidate,
    forceRefresh = false,
    resolved?: { mode: "CATEGORY" | "NAME_FALLBACK"; queryCategory: string | null },
  ) {
    const searchMode = resolved?.mode ?? pendingMode;
    if (!searchMode) return;

    setErrorMessage(null);
    setSearchPhase("running");

    const shouldForceRefresh = forceRefreshRef.current || forceRefresh;
    forceRefreshRef.current = false;

    try {
      const payload = await readJson<SearchRunResponse>("/api/search/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: searchProvider,
          queryTextOriginal: queryText,
          queryCategory: searchMode === "CATEGORY" ? resolved?.queryCategory ?? categoryResolution?.match?.geoapifyCategory ?? null : null,
          searchMode,
          locationQuery,
          locationLabel: candidate.label,
          geocodePlaceId: candidate.placeId,
          centerLat: candidate.lat,
          centerLon: candidate.lon,
          radiusMeters: Number(radiusKm) * 1000,
          forceRefresh: shouldForceRefresh,
        }),
      });

      setSummary(payload);
      setLatestSearchId(payload.summary.searchId);
      setSearchMessage(null);
      setLocationCandidates([]);

      // La vista predeterminada es la base maestra: conserva los resultados de
      // todas las ubicaciones. La ejecución puntual sigue disponible como vista.
      const nextFilters = { ...filters, searchId: "", query: "" };
      const [searchesPayload, usagePayload] = await Promise.all([
        readJson<{ searches: SearchSummaryRecord[] }>("/api/searches"),
        readJson<{ usage: ApiUsageSummary[] }>("/api/usage"),
      ]);

      await refreshBusinesses(nextFilters);
      setTableFilter("");
      setSearchHistory(searchesPayload.searches);
      setApiUsage(usagePayload.usage);
      setFilters(nextFilters);
      requestAnimationFrame(scrollToResults);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "La búsqueda no pudo completarse.");
    } finally {
      setSearchPhase("idle");
    }
  }

  const filtersActive = filters.hasWebsite !== "all" || Boolean(filters.category) || Boolean(filters.searchId) || Boolean(filters.query);

  return (
    <div className="min-h-screen bg-[#f5f5f7] pb-10">
      <div className="sticky top-0 z-30 border-b border-black/[0.06] bg-white/80 backdrop-blur-xl">
        <Toolbar
          queryText={queryText}
          locationQuery={locationQuery}
          radiusKm={radiusKm}
          radiusOptions={radiusOptions}
          provider={searchProvider}
          providerOptions={providerOptions}
          categories={categories}
          apiKeyConfigured={apiKeyConfigured}
          isPending={isPending || searchPhase !== "idle"}
          onQueryTextChange={setQueryText}
          onLocationQueryChange={handleLocationQueryChange}
          onRadiusChange={setRadiusKm}
          onProviderChange={(value) => setSearchProvider(value as SearchProvider)}
          onSearch={() => resolveSearch("CATEGORY")}
          onApproximate={() => resolveSearch("NAME_FALLBACK")}
          onForceRefresh={handleForceRefresh}
          onOpenSettings={() => {
            setSettingsTab("sources");
            setApiPanelOpen(true);
          }}
        />
      </div>

      {(searchPhase !== "idle" || summary || searchMessage || errorMessage) ? (
        <div className="pointer-events-none fixed inset-x-0 top-[60px] z-40 px-4 sm:px-6 lg:px-10" aria-live="polite">
          <div className="animate-reveal pointer-events-auto mx-auto flex max-w-[720px] items-start gap-3 rounded-2xl border border-black/[0.08] bg-white/95 p-3.5 shadow-[0_18px_45px_rgba(15,23,42,0.16)] backdrop-blur-xl">
            {searchPhase !== "idle" ? (
              <>
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600">
                  <LoaderCircleIcon size={17} className="animate-spin" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-950">
                    {searchPhase === "resolving" ? "Preparando tu búsqueda" : "Buscando negocios en la zona"}
                  </p>
                  <p className="mt-0.5 text-sm text-zinc-500">
                    {searchPhase === "resolving"
                      ? "Validamos el rubro y la ubicación para evitar resultados equivocados."
                      : "Esto puede tomar unos segundos. Te llevaremos a los resultados cuando esté listo."}
                  </p>
                </div>
              </>
            ) : summary ? (
              <>
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <CheckCircle2Icon size={18} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-zinc-950">
                    {summary.reused ? "Resultados recuperados de tu historial" : "Búsqueda completada"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600" data-numeric>
                    <span><strong className="font-semibold text-zinc-950">{summary.summary.newResultsCount}</strong> nuevos</span>
                    <span><strong className="font-semibold text-zinc-950">{summary.summary.existingResultsCount}</strong> ya registrados</span>
                    <span><strong className="font-semibold text-zinc-950">{summary.summary.resultsCount}</strong> totales</span>
                    <span><strong className="font-semibold text-zinc-950">{summary.summary.withPhoneCount}</strong> con teléfono</span>
                    <span><strong className="font-semibold text-zinc-950">{summary.summary.apiCalls}</strong> consultas API</span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={scrollToResults}
                      className="pressable inline-flex items-center gap-1 rounded-lg bg-zinc-950 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                    >
                      Ver resultados
                      <ArrowDownIcon size={13} aria-hidden="true" />
                    </button>
                    <span className="text-xs text-zinc-500">
                      {summary.summary.provider === "GOOGLE" ? "Google Places" : "Geoapify"} · {summary.summary.searchMode === "NAME_FALLBACK" ? "coincidencia aproximada" : "coincidencia exacta"}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <>
                <span className={cn("mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-full", errorMessage ? "bg-red-50 text-red-600" : "bg-orange-50 text-orange-600")}>
                  <MapPinIcon size={17} aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", errorMessage ? "text-red-700" : "text-zinc-900")}>
                    {errorMessage ?? searchMessage}
                  </p>
                  {!errorMessage && categoryResolution && !categoryResolution.matched ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {categoryResolution.suggestions.map((suggestion) => (
                        <Chip key={suggestion.key} onClick={() => setQueryText(suggestion.label)}>
                          {suggestion.label}
                        </Chip>
                      ))}
                    </div>
                  ) : null}
                </div>
              </>
            )}
            {searchPhase === "idle" ? (
              <button
                type="button"
                onClick={() => {
                  setSummary(null);
                  setSearchMessage(null);
                  setErrorMessage(null);
                }}
                aria-label="Cerrar notificación"
                className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-zinc-100 hover:text-zinc-900"
              >
                <XIcon size={15} />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <DashboardHero
        businesses={mapBusinesses}
        businessCount={businessCount}
        noWebsiteCount={noWebsiteCount}
        zoneCount={zoneCount}
        selectedLocation={selectedMapLocation}
        radiusKm={radiusKm}
        onLocationSelect={handleMapLocationSelect}
        onMapVisible={handleMapVisible}
      />

      {/* ── Split: tabla + mapa ──────────────────────────────── */}
      <section id="oportunidades" className="mx-auto mt-8 max-w-[1380px] scroll-mt-24 px-4 sm:px-6 lg:px-10">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.13em] text-zinc-500">Directorio vivo</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-[-0.04em] text-zinc-950">
              {summary ? "Resultados listos para revisar" : "Explorá las oportunidades"}
            </h2>
          </div>
          <p className="max-w-[32ch] text-right text-sm leading-5 text-zinc-500">
            {summary
              ? `${summary.summary.resultsCount} resultados encontrados · ${summary.summary.withPhoneCount} con teléfono · ${summary.summary.newResultsCount} nuevos.`
              : "Ordená, filtrá y exportá los negocios que querés convertir."}
          </p>
        </div>
        <div className="mb-4 flex min-h-statsbar flex-wrap items-center gap-2 rounded-2xl border border-black/[0.07] bg-white px-3 py-2 shadow-[0_6px_20px_rgba(15,23,42,0.04)]">
          <div className="flex shrink-0 rounded-lg bg-zinc-100 p-0.5" role="group" aria-label="Vista del directorio">
            <button
              type="button"
              onClick={() => updateFilter({ searchId: "" })}
              className={cn(
                "pressable rounded-md px-2.5 py-1 text-xs font-semibold",
                !filters.searchId ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-950",
              )}
            >
              Base maestra
            </button>
            <button
              type="button"
              disabled={!latestSearchId}
              onClick={() => latestSearchId && updateFilter({ searchId: latestSearchId })}
              className={cn(
                "pressable rounded-md px-2.5 py-1 text-xs font-semibold disabled:cursor-not-allowed disabled:opacity-40",
                filters.searchId === latestSearchId ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-950",
              )}
            >
              Última búsqueda
            </button>
          </div>

          <label className="flex h-7 min-w-0 max-w-[220px] flex-1 items-center gap-1.5 rounded border border-transparent px-2 transition-colors hover:bg-panel-2 focus-within:border-line-strong focus-within:bg-panel-2">
            <SearchIcon size={13} className="shrink-0 text-ink-3" aria-hidden="true" />
            <input
              value={tableFilter}
              onChange={(event) => setTableFilter(event.target.value)}
              placeholder="Filtrar directorio…"
              aria-label="Filtrar directorio"
              className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-3"
            />
          </label>

          <span className="h-4 w-px bg-line" aria-hidden="true" />

          <div className="w-[128px] shrink-0">
            <Combobox
              variant="toolbar"
              label="Sitio web"
              value={filters.hasWebsite}
              options={websiteOptions}
              onChange={(value) => updateFilter({ hasWebsite: value as FilterState["hasWebsite"] })}
            />
          </div>
          <div className="w-[150px] shrink-0">
            <Combobox
              variant="toolbar"
              label="Categoría"
              value={filters.category}
              options={categoryOptions}
              onChange={(value) => updateFilter({ category: value })}
            />
          </div>
          <div className="w-[150px] shrink-0">
            <Combobox
              variant="toolbar"
              label="Búsqueda"
              value={filters.searchId}
              options={searchOptions}
              onChange={(value) => updateFilter({ searchId: value })}
            />
          </div>

          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setTableFilter("");
                updateFilter({ hasWebsite: "all", category: "", searchId: "", query: "" });
              }}
              className="pressable rounded px-2 py-1 text-small text-ink-3 hover:bg-panel-2 hover:text-ink"
            >
              Limpiar
            </button>
          ) : null}

          {isRefreshing ? (
            <span className="inline-flex items-center gap-1.5 text-small text-ink-3">
              <LoaderCircleIcon size={13} className="animate-spin" aria-hidden="true" />
              Actualizando
            </span>
          ) : null}

          <div className="ml-auto flex shrink-0 items-center gap-3">
            <span className="text-small text-ink-2" data-numeric>
              <strong className="font-semibold text-ink">{businessCount}</strong> negocios
            </span>
            <span className="flex items-center gap-1.5 text-small text-signal" data-numeric>
              <span className="size-1.5 rounded-full bg-signal" aria-hidden="true" />
              <strong className="font-semibold">{noWebsiteCount}</strong> sin web
            </span>
            <span className="text-small text-ink-3" data-numeric>
              {zoneCount} {zoneCount === 1 ? "zona" : "zonas"}
            </span>

            <span className="h-4 w-px bg-line" aria-hidden="true" />

            <a
              href={`/api/export/xlsx?${exportQuery}`}
              className="pressable inline-flex items-center gap-1 rounded px-2 py-1 text-small text-ink-2 hover:bg-panel-2 hover:text-ink"
            >
              <DownloadIcon size={12} />
              XLSX
            </a>
            <a
              href={`/api/export/csv?${exportQuery}`}
              className="pressable inline-flex items-center gap-1 rounded px-2 py-1 text-small text-ink-2 hover:bg-panel-2 hover:text-ink"
            >
              <DownloadIcon size={12} />
              CSV
            </a>
          </div>
        </div>
        {summary ? (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2 text-sm text-blue-900">
            <span>
              {filters.searchId === summary.summary.searchId
                ? `Mostrando solo esta búsqueda y su radio de ${radiusKm} km.`
                : "Los resultados se agregaron a tu base maestra."}
            </span>
            <button
              type="button"
              onClick={() => updateFilter({ searchId: filters.searchId === summary.summary.searchId ? "" : summary.summary.searchId })}
              className="font-semibold underline decoration-blue-300 underline-offset-2 hover:text-blue-700"
            >
              {filters.searchId === summary.summary.searchId ? "Ver base maestra" : "Ver solo esta búsqueda"}
            </button>
          </div>
        ) : null}
        <div className="overflow-hidden rounded-[24px] border border-black/[0.07] bg-white shadow-[0_10px_30px_rgba(15,23,42,0.05)]">
          <BusinessTable
            data={businesses}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onHover={() => undefined}
            isLoading={isRefreshing}
            page={pagination.page}
            pageSize={pagination.pageSize}
            total={pagination.total}
            onPageChange={changePage}
          />
        </div>
      </section>

      {/* ── Drawer: configuración ─────────────────────────────── */}
      {apiPanelOpen ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 animate-fade-in bg-ink/20" onClick={() => setApiPanelOpen(false)} aria-hidden="true" />
          <aside
            className="absolute right-0 top-0 flex h-full w-[min(460px,100%)] animate-slide-in-right flex-col bg-canvas shadow-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Configuración"
          >
            <div className="flex h-toolbar shrink-0 items-center justify-between border-b border-line px-3">
              <div className="flex items-center gap-2">
                <h2 className="text-heading text-ink">Configuración</h2>
                <Tag tone="neutral">
                  {Object.values(configuredApiKeys).filter(Boolean).length} de {API_PROVIDERS.length}
                </Tag>
              </div>
              <button
                type="button"
                ref={closeButtonRef}
                onClick={() => setApiPanelOpen(false)}
                aria-label="Cerrar panel"
                className="inline-flex size-7 items-center justify-center rounded text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
              >
                <XIcon size={15} />
              </button>
            </div>

            <nav className="flex shrink-0 gap-1 border-b border-line px-3 py-2" aria-label="Secciones de configuración">
              {([
                ["sources", "Fuentes API"],
                ["usage", "Consumo"],
                ["history", "Historial"],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setSettingsTab(tab)}
                  className={cn(
                    "rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors",
                    settingsTab === tab ? "bg-zinc-950 text-white" : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-950",
                  )}
                >
                  {label}
                </button>
              ))}
            </nav>

            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {settingsTab === "sources" ? (
            <div className="flex flex-col gap-4">
              <p className="text-body text-ink-2">
                Guardá las claves de tus fuentes de datos en un solo lugar. Todas se cifran y nunca se exponen al navegador.
              </p>

              <div className="grid gap-2">
                {API_PROVIDERS.map((provider) => {
                  const configured = configuredApiKeys[provider.id];
                  const selected = provider.id === selectedApiProvider;
                  return (
                    <button
                      key={provider.id}
                      type="button"
                      onClick={() => {
                        setSelectedApiProvider(provider.id);
                        setApiKey("");
                        setApiKeyMessage(null);
                      }}
                      className={cn(
                        "flex items-center justify-between gap-3 rounded-xl border p-3 text-left transition-colors",
                        selected ? "border-zinc-900 bg-zinc-950 text-white" : "border-line bg-white hover:border-line-strong",
                      )}
                    >
                      <span className="min-w-0">
                        <span className={cn("block text-sm font-semibold", selected ? "text-white" : "text-ink")}>{provider.name}</span>
                        <span className={cn("mt-0.5 block text-xs", selected ? "text-zinc-300" : "text-ink-3")}>{provider.description}</span>
                      </span>
                      <span className={cn("shrink-0 rounded-full px-2 py-1 text-[10px] font-semibold", selected ? "bg-white/15 text-white" : configured ? "bg-emerald-50 text-emerald-700" : "bg-panel-2 text-ink-3")}>
                        {configured ? "Configurada" : provider.active ? "Necesaria" : "Opcional"}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="rounded-xl border border-line bg-panel p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-ink">{selectedProvider.name}</p>
                    <p className="mt-0.5 text-small text-ink-3">
                      {selectedProvider.active
                        ? "Fuente disponible para geocodificación y descubrimiento de negocios."
                        : "Clave lista para conectar esta fuente en una próxima integración."}
                    </p>
                  </div>
                  <Tag tone={configuredApiKeys[selectedApiProvider] ? "neutral" : "signal"}>
                    {configuredApiKeys[selectedApiProvider] ? "Lista" : "Sin clave"}
                  </Tag>
                </div>

                <label className="mt-3 grid gap-1.5">
                  <MicroLabel>API key</MicroLabel>
                  <input
                    type="password"
                    placeholder={`Pegá tu API key de ${selectedProvider.name}`}
                    value={apiKey}
                    onChange={(event) => setApiKey(event.target.value)}
                    className="h-8 w-full rounded border border-line bg-canvas px-2.5 text-body text-ink outline-none transition-colors placeholder:text-ink-3 hover:border-line-strong focus:border-accent"
                  />
                </label>

                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={saveApiKey}
                    disabled={!apiKey.trim()}
                    className="h-8 flex-1 rounded bg-accent px-3 text-body font-medium text-accent-foreground transition-colors hover:bg-accent-hover disabled:bg-panel-2 disabled:text-ink-3"
                  >
                    Guardar clave
                  </button>
                  <button
                    type="button"
                    onClick={clearApiKey}
                    disabled={!configuredApiKeys[selectedApiProvider]}
                    className="h-8 rounded border border-line px-3 text-body text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink disabled:opacity-40 disabled:hover:bg-transparent"
                  >
                    Eliminar
                  </button>
                </div>
              </div>

              {apiKeyMessage ? <p className="text-small text-ink-2">{apiKeyMessage}</p> : null}

              <p className="text-small text-ink-3" data-numeric>
                Elegí la fuente en la barra de búsqueda. Caché de búsquedas: {cacheTtlDays} días.
              </p>
            </div>
              ) : settingsTab === "usage" ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-body font-semibold text-ink">Consumo registrado</p>
                    <p className="mt-1 text-small text-ink-3">Llamadas de descubrimiento completadas por la app. El importe final de Google se confirma en Cloud Billing.</p>
                  </div>
                  <div className="grid gap-3">
                    {apiUsage.map((usage) => {
                      const name = usage.provider === "GOOGLE" ? "Google Places" : "Geoapify";
                      return (
                        <article key={usage.provider} className="rounded-xl border border-line bg-panel p-3">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-body font-semibold text-ink">{name}</span>
                            <span className="rounded-full bg-canvas px-2 py-1 text-micro text-ink-3 ring-1 ring-line">{usage.searchesThisMonth} búsquedas</span>
                          </div>
                          <div className="mt-3 flex items-baseline gap-2" data-numeric>
                            <strong className="text-metric text-ink">{usage.callsThisMonth}</strong>
                            <span className="text-small text-ink-3">consultas este mes</span>
                          </div>
                          <p className="mt-1 text-small text-ink-3" data-numeric>{usage.callsToday} hoy · {usage.searchesToday} búsquedas hoy</p>
                        </article>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-body font-semibold text-ink">Historial de búsquedas</p>
                      <p className="mt-0.5 text-small text-ink-3" data-numeric>{searchHistory.length} · últimas 50</p>
                    </div>
                  </div>
                  {searchHistory.length === 0 ? (
                    <p className="rounded-xl border border-line bg-panel p-3 text-body text-ink-3">Todavía no corriste ninguna búsqueda.</p>
                  ) : (
                    <div className="overflow-hidden rounded-xl border border-line">
                      {searchHistory.map((item) => (
                        <article key={item.searchId} className="border-b border-line px-3 py-2.5 last:border-b-0">
                          <div className="flex items-center justify-between gap-3">
                            <span className="min-w-0 truncate text-body text-ink">{item.queryTextOriginal} · {item.locationLabel}</span>
                            <div className="flex shrink-0 items-center gap-2">
                              <Tag tone={item.status === "FAILED" ? "danger" : "neutral"}>{STATUS_LABELS[item.status] ?? item.status}</Tag>
                              <button
                                type="button"
                                onClick={() => {
                                  setApiPanelOpen(false);
                                  updateFilter({ searchId: item.searchId });
                                }}
                                className="pressable rounded-md bg-zinc-100 px-2 py-1 text-[11px] font-semibold text-zinc-700 hover:bg-zinc-200"
                              >
                                Ver
                              </button>
                            </div>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-small text-ink-3" data-numeric>
                            <FormattedDate value={item.executedAt} />
                            <span>{item.resultsCount} resultados</span>
                            <span>{item.withPhoneCount} con teléfono</span>
                            <span>{item.provider === "GOOGLE" ? "Google" : "Geoapify"}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}

      {/* ── Modal: confirmar ubicación ───────────────────────── */}
      {locationCandidates.length > 0 ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-6">
          <div className="absolute inset-0 animate-fade-in bg-ink/25" onClick={() => setLocationCandidates([])} aria-hidden="true" />
          <div
            className="relative max-h-[calc(100vh-3rem)] w-[min(440px,100%)] overflow-hidden rounded-lg bg-canvas shadow-pop"
            role="dialog"
            aria-modal="true"
            aria-label="Confirmar ubicación"
          >
            <div className="flex items-center justify-between border-b border-line px-3 py-2.5">
              <h2 className="text-heading text-ink">Confirmá la ubicación</h2>
              <button
                type="button"
                ref={locationConfirmOpenRef}
                onClick={() => setLocationCandidates([])}
                aria-label="Cerrar"
                className="inline-flex size-7 items-center justify-center rounded text-ink-3 transition-colors hover:bg-panel-2 hover:text-ink"
              >
                <XIcon size={15} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-auto">
              {locationCandidates.map((candidate) => (
                <div
                  key={`${candidate.label}-${candidate.lat}-${candidate.lon}`}
                  className="flex items-center justify-between gap-3 border-b border-line px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="truncate text-body text-ink">{candidate.label}</div>
                    <div className="text-small text-ink-3" data-numeric>
                      {Math.round(candidate.confidence * 100)}% · {candidate.resultType}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => runSearch(candidate)}
                      className="h-7 rounded bg-accent px-3 text-small font-medium text-accent-foreground transition-colors hover:bg-accent-hover"
                    >
                      Usar
                    </button>
                    {summary?.reused ? null : (
                      <button
                        type="button"
                        onClick={() => runSearch(candidate, true)}
                        className="h-7 rounded border border-line px-2 text-small text-ink-2 transition-colors hover:bg-panel-2 hover:text-ink"
                      >
                        Forzar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InsightCard({
  eyebrow,
  value,
  detail,
  accent = false,
}: {
  eyebrow: string;
  value: string;
  detail: string;
  accent?: boolean;
}) {
  return (
    <article className="animate-reveal rounded-2xl border border-black/[0.07] bg-white p-5 shadow-[0_6px_20px_rgba(15,23,42,0.04)] transition-transform duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_28px_rgba(15,23,42,0.08)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-zinc-500">{eyebrow}</p>
      <p className={accent ? "mt-3 text-xl font-semibold tracking-[-0.04em] text-orange-600" : "mt-3 text-xl font-semibold tracking-[-0.04em] text-zinc-950"}>{value}</p>
      <p className="mt-2 text-sm leading-5 text-zinc-500">{detail}</p>
    </article>
  );
}
