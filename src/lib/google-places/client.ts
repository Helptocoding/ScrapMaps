const TEXT_SEARCH_URL = "https://places.googleapis.com/v1/places:searchText";
const NEARBY_SEARCH_URL = "https://places.googleapis.com/v1/places:searchNearby";
const MAX_TEXT_PAGES = 3;
const MAX_GRID_CALLS = 9;

const FIELD_MASK = [
  "places.id",
  "places.displayName",
  "places.formattedAddress",
  "places.location",
  "places.primaryType",
  "places.types",
  "places.nationalPhoneNumber",
  "places.internationalPhoneNumber",
  "places.websiteUri",
  "places.rating",
  "places.userRatingCount",
  "places.businessStatus",
].join(",");

export type GooglePlace = {
  id?: string;
  displayName?: { text?: string };
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
  primaryType?: string;
  types?: string[];
  nationalPhoneNumber?: string;
  internationalPhoneNumber?: string;
  websiteUri?: string;
  rating?: number;
  userRatingCount?: number;
  businessStatus?: string;
};

type GoogleSearchResponse = {
  places?: GooglePlace[];
  nextPageToken?: string;
  error?: { message?: string; status?: string };
};

export type GoogleSearchStats = {
  textPages: number;
  nearbyCalls: number;
  totalCalls: number;
  gridCells: number;
};

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function requestGooglePlaces(url: string, apiKey: string, body: Record<string, unknown>, fieldMask = FIELD_MASK) {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": apiKey,
        "X-Goog-FieldMask": fieldMask,
      },
      body: JSON.stringify(body),
    });

    const payload = (await response.json()) as GoogleSearchResponse;
    if (response.ok && !payload.error) return payload;

    const message = payload.error?.message ?? "Google Places no pudo completar la consulta.";
    lastError = new Error(message);
    if (response.status !== 429 || attempt === 2) break;
    await sleep(500 * 2 ** attempt);
  }

  throw lastError ?? new Error("Google Places no pudo completar la consulta.");
}

function normalizeQuery(queryText: string, locationLabel: string) {
  if (locationLabel.startsWith("Punto seleccionado")) return queryText.trim();
  return `${queryText.trim()} en ${locationLabel.trim()}`;
}

function isWithinRadius(place: GooglePlace, centerLat: number, centerLon: number, radiusMeters: number) {
  const latitude = place.location?.latitude;
  const longitude = place.location?.longitude;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return false;

  const toRadians = (value: number) => (value * Math.PI) / 180;
  const deltaLat = toRadians(latitude! - centerLat);
  const deltaLon = toRadians(longitude! - centerLon);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(centerLat)) * Math.cos(toRadians(latitude!)) * Math.sin(deltaLon / 2) ** 2;

  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radiusMeters;
}

export function resolveGooglePlaceTypes(queryText: string) {
  const text = queryText.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const mappings: Array<[RegExp, string[]]> = [
    [/veterin/, ["veterinary_care"]],
    [/dent|ortodonc/, ["dentist"]],
    [/farmac/, ["pharmacy"]],
    [/barber|peluquer|salon/, ["barber_shop", "hair_salon"]],
    [/spa|masaj/, ["spa"]],
    [/tatuaj|tattoo/, ["tattoo_shop"]],
    [/cafeter|cafe|coffee/, ["cafe"]],
    [/bar|cantina/, ["bar"]],
    [/pizza/, ["pizza_restaurant"]],
    [/hamburg|burger/, ["hamburger_restaurant"]],
    [/restaur|taco|sushi|comida/, ["restaurant"]],
    [/panader|bakery/, ["bakery"]],
    [/abogad|despacho legal/, ["lawyer"]],
    [/contador|contaduria/, ["accounting"]],
    [/inmobiliar|bienes raices/, ["real_estate_agency"]],
    [/electricista/, ["electrician"]],
    [/carpinter/, ["carpenter"]],
    [/cerrajer/, ["locksmith"]],
    [/fotograf/, ["photography_studio"]],
    [/agencia.*viaje|viajes/, ["travel_agency"]],
    [/taller|mecanic/, ["car_repair"]],
    [/autolavado|lavado.*auto|car wash/, ["car_wash"]],
  ];

  return mappings.find(([pattern]) => pattern.test(text))?.[1] ?? [];
}

function buildSearchGrid(centerLat: number, centerLon: number, radiusMeters: number) {
  if (radiusMeters <= 3500) return [[centerLat, centerLon] as const];

  const steps = radiusMeters <= 9000 ? [-0.5, 0, 0.5] : [-0.66, 0, 0.66];
  const latitudeOffset = radiusMeters / 111_320;
  const longitudeOffset = radiusMeters / (111_320 * Math.cos((centerLat * Math.PI) / 180));
  const points: Array<readonly [number, number]> = [];

  for (const latStep of steps) {
    for (const lonStep of steps) {
      if (Math.hypot(latStep, lonStep) > 0.95) continue;
      points.push([centerLat + latitudeOffset * latStep, centerLon + longitudeOffset * lonStep]);
    }
  }

  return points.slice(0, MAX_GRID_CALLS);
}

async function textSearchPaginated(args: {
  apiKey: string;
  queryText: string;
  locationLabel: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
}) {
  const places: GooglePlace[] = [];
  let pageToken: string | undefined;
  let calls = 0;

  for (let page = 0; page < MAX_TEXT_PAGES; page += 1) {
    const body: Record<string, unknown> = {
      textQuery: normalizeQuery(args.queryText, args.locationLabel),
      pageSize: 20,
      languageCode: "es",
      regionCode: "MX",
      // Text Search permite círculo como sesgo, no como restricción. El
      // filtro final por distancia mantiene el contrato del radio elegido.
      locationBias: {
        circle: {
          center: { latitude: args.centerLat, longitude: args.centerLon },
          radius: args.radiusMeters,
        },
      },
      ...(pageToken ? { pageToken } : {}),
    };

    const payload = await requestGooglePlaces(TEXT_SEARCH_URL, args.apiKey, body, `${FIELD_MASK},nextPageToken`);
    calls += 1;
    places.push(...(payload.places ?? []));
    pageToken = payload.nextPageToken;
    if (!pageToken) break;
    await sleep(150);
  }

  return { places, calls };
}

async function nearbySearchGrid(args: {
  apiKey: string;
  queryText: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
}) {
  const points = buildSearchGrid(args.centerLat, args.centerLon, args.radiusMeters);
  const types = resolveGooglePlaceTypes(args.queryText);
  const cellRadius = Math.min(10_000, Math.max(1_500, Math.round(args.radiusMeters / 2)));
  const places: GooglePlace[] = [];

  for (const [latitude, longitude] of points) {
    const payload = await requestGooglePlaces(NEARBY_SEARCH_URL, args.apiKey, {
      ...(types.length > 0 ? { includedTypes: types } : {}),
      maxResultCount: 20,
      languageCode: "es",
      regionCode: "MX",
      rankPreference: "DISTANCE",
      locationRestriction: { circle: { center: { latitude, longitude }, radius: cellRadius } },
    });
    places.push(...(payload.places ?? []));
    await sleep(120);
  }

  return { places, calls: points.length, gridCells: points.length };
}

/** Combina texto y cuadrícula; el ID de Google elimina duplicados antes de llegar a la base. */
export async function searchGooglePlaces(args: {
  apiKey: string;
  queryText: string;
  locationLabel: string;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
}) {
  const [text, nearby] = await Promise.all([
    textSearchPaginated(args),
    nearbySearchGrid(args),
  ]);
  const byId = new Map<string, GooglePlace>();

  for (const place of [...text.places, ...nearby.places]) {
    if (place.id && isWithinRadius(place, args.centerLat, args.centerLon, args.radiusMeters)) {
      byId.set(place.id, place);
    }
  }

  const stats: GoogleSearchStats = {
    textPages: text.calls,
    nearbyCalls: nearby.calls,
    totalCalls: text.calls + nearby.calls,
    gridCells: nearby.gridCells,
  };

  return { places: Array.from(byId.values()), stats };
}

export async function resolveGoogleLocation(args: { apiKey: string; locationQuery: string }) {
  const payload = await requestGooglePlaces(
    TEXT_SEARCH_URL,
    args.apiKey,
    { textQuery: args.locationQuery, pageSize: 5, languageCode: "es", regionCode: "MX" },
    "places.id,places.displayName,places.formattedAddress,places.location",
  );

  return (payload.places ?? [])
    .filter((place) => Number.isFinite(place.location?.latitude) && Number.isFinite(place.location?.longitude))
    .map((place) => ({
      placeId: place.id ?? null,
      label: place.formattedAddress ?? place.displayName?.text ?? args.locationQuery,
      lat: place.location!.latitude!,
      lon: place.location!.longitude!,
      resultType: "google_place",
      confidence: 1,
    }));
}
