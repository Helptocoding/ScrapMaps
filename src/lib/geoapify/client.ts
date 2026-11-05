import type { GeoapifyGeocodeResponse, GeoapifyPlacesResponse } from "@/lib/geoapify/types";
import type { LocationCandidate } from "@/types/app";

export class GeoapifyError extends Error {
  code: string;
  status: number;

  constructor(code: string, status: number, message: string) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function buildUrl(path: string, params: Record<string, string>) {
  const url = new URL(path, "https://api.geoapify.com");

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  return url;
}

async function geoapifyFetch<T>(url: URL) {
  const response = await fetch(url, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new GeoapifyError("INVALID_API_KEY", response.status, "La API key de Geoapify no es valida o no tiene permisos.");
    }

    if (response.status === 429) {
      throw new GeoapifyError("RATE_LIMIT", response.status, "Geoapify devolvio rate limit. Espera un momento y vuelve a intentar.");
    }

    throw new GeoapifyError(
      "UPSTREAM_ERROR",
      response.status,
      "Geoapify no pudo responder correctamente. Intenta de nuevo en unos minutos.",
    );
  }

  return (await response.json()) as T;
}

export async function validateGeoapifyApiKey(apiKey: string) {
  const url = buildUrl("/v1/geocode/search", {
    text: "Monterrey",
    limit: "1",
    format: "json",
    apiKey,
  });

  await geoapifyFetch<GeoapifyGeocodeResponse>(url);
}

export async function resolveLocationCandidates(apiKey: string, locationQuery: string) {
  const url = buildUrl("/v1/geocode/search", {
    text: locationQuery,
    limit: "5",
    format: "json",
    bias: "countrycode:none",
    apiKey,
  });

  const payload = await geoapifyFetch<GeoapifyGeocodeResponse>(url);

  return payload.results.map<LocationCandidate>((result) => ({
    placeId: result.place_id ?? null,
    label: result.formatted ?? locationQuery,
    lat: result.lat,
    lon: result.lon,
    resultType: result.result_type ?? "unknown",
    confidence: result.rank?.confidence ?? 0,
    city: result.city ?? null,
    state: result.state ?? null,
    country: result.country ?? null,
  }));
}

export async function searchPlacesByCategory(args: {
  apiKey: string;
  category: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
}) {
  const url = buildUrl("/v2/places", {
    categories: args.category,
    filter: `circle:${args.centerLon},${args.centerLat},${args.radiusMeters}`,
    limit: "200",
    apiKey: args.apiKey,
  });

  return geoapifyFetch<GeoapifyPlacesResponse>(url);
}

export async function searchPlacesByNameFallback(args: {
  apiKey: string;
  categories: string[];
  queryText: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
}) {
  const url = buildUrl("/v2/places", {
    categories: args.categories.join(","),
    name: args.queryText,
    filter: `circle:${args.centerLon},${args.centerLat},${args.radiusMeters}`,
    limit: "200",
    apiKey: args.apiKey,
  });

  return geoapifyFetch<GeoapifyPlacesResponse>(url);
}
