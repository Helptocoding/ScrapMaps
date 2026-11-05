import { Prisma } from "@prisma/client";

import { FALLBACK_PLACE_CATEGORIES } from "@/lib/categories/dictionary";
import { getCategoryLabel } from "@/lib/categories/resolver";
import { env } from "@/lib/env";
import { GeoapifyError, searchPlacesByCategory, searchPlacesByNameFallback } from "@/lib/geoapify/client";
import type { GeoapifyPlaceFeature } from "@/lib/geoapify/types";
import { searchGooglePlaces, type GooglePlace } from "@/lib/google-places/client";
import { prisma } from "@/lib/prisma";
import { buildSearchFingerprint } from "@/lib/search/fingerprint";
import { ensureWorkspace } from "@/lib/workspace";
import type { BusinessRecord, SearchProvider, SearchRunResponse } from "@/types/app";

const BUSINESS_WITH_RESULTS = {
  include: {
    searchResults: {
      include: {
        search: {
          select: {
            locationLabel: true,
          },
        },
      },
    },
  },
} as const;

type BusinessWithResults = Prisma.BusinessGetPayload<typeof BUSINESS_WITH_RESULTS>;

function extractText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function scoreLead(phone: string | null, website: string | null, rating: number | null, reviewCount: number | null) {
  let score = 0;
  if (phone) score += 3;
  if (!website) score += 3;
  if ((reviewCount ?? 0) >= 30) score += 3;
  else if ((reviewCount ?? 0) >= 10) score += 1;
  if ((rating ?? 0) >= 4) score += 1;
  return score;
}

type PreparedBusiness = {
  placeId: string;
  externalPlaceId: string;
  provider: SearchProvider;
  name: string;
  primaryCategory: string;
  categoryLabel: string | null;
  address: string;
  phone: string | null;
  website: string | null;
  hasWebsite: boolean;
  lat: number;
  lon: number;
  city: string | null;
  state: string | null;
  postcode: string | null;
  country: string | null;
  allCategories: string | null;
  rating: number | null;
  reviewCount: number | null;
  leadScore: number;
  contactSource: string | null;
};

function featureToBusiness(feature: GeoapifyPlaceFeature, fallbackCategory: string | null): PreparedBusiness | null {
  const properties = feature.properties;
  const rawCategories = Array.isArray(properties.categories)
    ? properties.categories.filter((entry): entry is string => typeof entry === "string")
    : [];

  const datasource = (properties.datasource ?? {}) as Record<string, unknown>;
  const rawDatasource = ((datasource.raw as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;

  const website =
    extractText(properties.website) ??
    extractText(rawDatasource.website) ??
    extractText(rawDatasource["contact:website"]);

  const phone =
    extractText(properties.phone) ??
    extractText(rawDatasource.phone) ??
    extractText(rawDatasource["contact:phone"]);

  const lon = properties.lon ?? feature.geometry?.coordinates?.[0] ?? 0;
  const lat = properties.lat ?? feature.geometry?.coordinates?.[1] ?? 0;
  const placeId = extractText(properties.place_id);

  if (!placeId) {
    return null;
  }

  const primaryCategory = rawCategories[0] ?? fallbackCategory ?? "unknown";

  const joinedAddress = [extractText(properties.address_line1), extractText(properties.address_line2)]
    .filter((entry): entry is string => Boolean(entry))
    .join(", ");

  return {
    placeId: `geoapify:${placeId}`,
    externalPlaceId: placeId,
    provider: "GEOAPIFY",
    name: extractText(properties.name) ?? "Negocio sin nombre",
    primaryCategory,
    categoryLabel: getCategoryLabel(primaryCategory),
    address: (extractText(properties.formatted) ?? joinedAddress) || "Direccion no disponible",
    phone,
    website,
    hasWebsite: Boolean(website),
    lat,
    lon,
    city: extractText(properties.city),
    state: extractText(properties.state),
    postcode: extractText(properties.postcode),
    country: extractText(properties.country),
    allCategories: rawCategories.join("|"),
    rating: null,
    reviewCount: null,
    leadScore: scoreLead(phone, website, null, null),
    contactSource: phone ? "Geoapify" : null,
  };
}

function googlePlaceToBusiness(place: GooglePlace, fallbackCategory: string | null): PreparedBusiness | null {
  const externalPlaceId = extractText(place.id);
  const lat = place.location?.latitude;
  const lon = place.location?.longitude;
  if (!externalPlaceId || !Number.isFinite(lat) || !Number.isFinite(lon)) return null;

  const phone = extractText(place.internationalPhoneNumber) ?? extractText(place.nationalPhoneNumber);
  const website = extractText(place.websiteUri);
  const rating = typeof place.rating === "number" ? place.rating : null;
  const reviewCount = typeof place.userRatingCount === "number" ? place.userRatingCount : null;
  const categories = Array.isArray(place.types) ? place.types.filter((type): type is string => typeof type === "string") : [];
  const primaryCategory = extractText(place.primaryType) ?? categories[0] ?? fallbackCategory ?? "unknown";

  return {
    placeId: `google:${externalPlaceId}`,
    externalPlaceId,
    provider: "GOOGLE",
    name: extractText(place.displayName?.text) ?? "Negocio sin nombre",
    primaryCategory,
    categoryLabel: getCategoryLabel(primaryCategory),
    address: extractText(place.formattedAddress) ?? "Direccion no disponible",
    phone,
    website,
    hasWebsite: Boolean(website),
    lat: lat!,
    lon: lon!,
    city: null,
    state: null,
    postcode: null,
    country: "Mexico",
    allCategories: categories.join("|"),
    rating,
    reviewCount,
    leadScore: scoreLead(phone, website, rating, reviewCount),
    contactSource: phone ? "Google Places" : null,
  };
}

async function mapBusinessesByPlaceIds(placeIds: string[]) {
  const businesses = await prisma.business.findMany({
    where: {
      placeId: {
        in: placeIds,
      },
    },
    include: BUSINESS_WITH_RESULTS.include,
  });

  return businesses.map<BusinessRecord>((business: BusinessWithResults) => ({
    placeId: business.placeId,
    provider: business.provider,
    name: business.name,
    primaryCategory: business.primaryCategory,
    categoryLabel: business.categoryLabel ?? getCategoryLabel(business.primaryCategory),
    address: business.address,
    phone: business.phone,
    website: business.website,
    hasWebsite: business.hasWebsite,
    lat: business.lat,
    lon: business.lon,
    city: business.city,
    state: business.state,
    country: business.country,
    rating: business.rating,
    reviewCount: business.reviewCount,
    leadScore: business.leadScore,
    contactSource: business.contactSource,
    searchCount: business.searchResults.length,
    searchLabels: Array.from(
      new Set(business.searchResults.map((result: BusinessWithResults["searchResults"][number]) => result.search.locationLabel)),
    ),
  }));
}

export async function runBusinessSearch(args: {
  apiKey: string;
  provider: SearchProvider;
  queryTextOriginal: string;
  queryCategory: string | null;
  searchMode: "CATEGORY" | "NAME_FALLBACK";
  locationQuery: string;
  locationLabel: string;
  geocodePlaceId: string | null;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
  forceRefresh: boolean;
}): Promise<SearchRunResponse> {
  const workspace = await ensureWorkspace();
  const fingerprint = buildSearchFingerprint({
    workspaceId: workspace.id,
    provider: args.provider,
    searchMode: args.searchMode,
    queryCategory: args.queryCategory,
    queryTextOriginal: args.queryTextOriginal,
    geocodePlaceId: args.geocodePlaceId,
    centerLat: args.centerLat,
    centerLon: args.centerLon,
    radiusMeters: args.radiusMeters,
  });

  const reusableSearch = await prisma.search.findFirst({
    where: {
      workspaceId: workspace.id,
      fingerprint,
      status: "COMPLETED",
      staleAfterAt: {
        gt: new Date(),
      },
    },
    orderBy: {
      executedAt: "desc",
    },
  });

  if (reusableSearch && !args.forceRefresh) {
    const reused = await prisma.search.create({
      data: {
        workspaceId: workspace.id,
        queryTextOriginal: args.queryTextOriginal,
        queryCategory: args.queryCategory,
        searchMode: args.searchMode,
        locationQuery: args.locationQuery,
        locationLabel: args.locationLabel,
        geocodePlaceId: args.geocodePlaceId,
        centerLat: args.centerLat,
        centerLon: args.centerLon,
        radiusMeters: args.radiusMeters,
        fingerprint,
        provider: args.provider,
        status: "REUSED",
        resultsCount: reusableSearch.resultsCount,
        newResultsCount: reusableSearch.newResultsCount,
        existingResultsCount: reusableSearch.existingResultsCount,
        withPhoneCount: reusableSearch.withPhoneCount,
        apiCalls: reusableSearch.apiCalls,
        reusedFromSearchId: reusableSearch.id,
        // Important: reusing a cached search must not extend the original TTL window.
        staleAfterAt: reusableSearch.staleAfterAt,
      },
      include: {
        reusedFromSearch: true,
      },
    });

    const originalResults = await prisma.searchResult.findMany({
      where: { searchId: reusableSearch.id },
      select: { businessPlaceId: true },
    });

    const existingBusinesses = await mapBusinessesByPlaceIds(originalResults.map((item: { businessPlaceId: string }) => item.businessPlaceId));

    return {
      reused: true,
      message: `Resultados reutilizados desde ${reusableSearch.executedAt.toLocaleString("es-MX")}.`,
      summary: {
        searchId: reused.id,
        status: reused.status,
        searchMode: reused.searchMode,
        queryTextOriginal: reused.queryTextOriginal,
        queryCategory: reused.queryCategory,
        locationLabel: reused.locationLabel,
        executedAt: reused.executedAt.toISOString(),
        staleAfterAt: reused.staleAfterAt?.toISOString() ?? null,
        reusedFromSearchId: reused.reusedFromSearchId,
        reusedFromExecutedAt: reused.reusedFromSearch?.executedAt.toISOString() ?? null,
        resultsCount: reused.resultsCount,
        newResultsCount: reused.newResultsCount,
        existingResultsCount: reused.existingResultsCount,
        provider: reused.provider,
        withPhoneCount: reused.withPhoneCount,
        apiCalls: reused.apiCalls,
        isRefresh: reused.isRefresh,
        errorCode: reused.errorCode,
        errorMessage: reused.errorMessage,
      },
      newBusinesses: [],
      existingBusinesses,
    };
  }

  const pendingSearch = await prisma.search.create({
    data: {
      workspaceId: workspace.id,
      queryTextOriginal: args.queryTextOriginal,
      queryCategory: args.queryCategory,
        searchMode: args.searchMode,
      locationQuery: args.locationQuery,
      locationLabel: args.locationLabel,
      geocodePlaceId: args.geocodePlaceId,
      centerLat: args.centerLat,
      centerLon: args.centerLon,
      radiusMeters: args.radiusMeters,
      fingerprint,
      provider: args.provider,
      isRefresh: args.forceRefresh,
      status: "PENDING",
    },
  });

  try {
    let apiCalls = 0;
    let preparedBusinesses: PreparedBusiness[];

    if (args.provider === "GOOGLE") {
      const googleResults = await searchGooglePlaces({
        apiKey: args.apiKey,
        queryText: args.queryTextOriginal,
        locationLabel: args.locationLabel,
        centerLat: args.centerLat,
        centerLon: args.centerLon,
        radiusMeters: args.radiusMeters,
      });
      apiCalls = googleResults.stats.totalCalls;
      preparedBusinesses = googleResults.places
        .map((place) => googlePlaceToBusiness(place, args.queryCategory))
        .filter((entry): entry is PreparedBusiness => Boolean(entry));
    } else {
      const placesPayload =
        args.searchMode === "CATEGORY" && args.queryCategory
          ? await searchPlacesByCategory({
              apiKey: args.apiKey,
              category: args.queryCategory,
              centerLat: args.centerLat,
              centerLon: args.centerLon,
              radiusMeters: args.radiusMeters,
            })
          : await searchPlacesByNameFallback({
              apiKey: args.apiKey,
              categories: FALLBACK_PLACE_CATEGORIES,
              queryText: args.queryTextOriginal,
              centerLat: args.centerLat,
              centerLon: args.centerLon,
              radiusMeters: args.radiusMeters,
            });

      apiCalls = 1;
      preparedBusinesses = placesPayload.features
        .map((feature) => featureToBusiness(feature, args.queryCategory))
        .filter((entry): entry is PreparedBusiness => Boolean(entry));
    }

    const existing = await prisma.business.findMany({
      where: {
        placeId: {
          in: preparedBusinesses.map((item) => item.placeId),
        },
      },
      select: {
        placeId: true,
      },
    });

    const existingIds = new Set(existing.map((item: { placeId: string }) => item.placeId));
    const newIds: string[] = [];
    const existingIdsForResponse: string[] = [];

    const staleAfterAt = new Date(Date.now() + env.SEARCH_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000);

    // Una respuesta de Places puede traer cientos de negocios. Cada uno
    // requiere upsert + vínculo a la búsqueda, por lo que el límite interactivo
    // predeterminado de Prisma (5 s) cerraba la transacción a mitad del lote.
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      for (const business of preparedBusinesses) {
        const alreadyKnown = existingIds.has(business.placeId);

        if (alreadyKnown) {
          existingIdsForResponse.push(business.placeId);
        } else {
          newIds.push(business.placeId);
        }

        await tx.business.upsert({
          where: {
            placeId: business.placeId,
          },
          update: {
            provider: business.provider,
            externalPlaceId: business.externalPlaceId,
            name: business.name,
            primaryCategory: business.primaryCategory,
            categoryLabel: business.categoryLabel,
            address: business.address,
            phone: business.phone,
            website: business.website,
            hasWebsite: business.hasWebsite,
            lat: business.lat,
            lon: business.lon,
            city: business.city,
            state: business.state,
            postcode: business.postcode,
            country: business.country,
            allCategories: business.allCategories,
            rating: business.rating,
            reviewCount: business.reviewCount,
            leadScore: business.leadScore,
            contactSource: business.contactSource,
            lastSeenAt: new Date(),
          },
          create: {
            placeId: business.placeId,
            provider: business.provider,
            externalPlaceId: business.externalPlaceId,
            name: business.name,
            primaryCategory: business.primaryCategory,
            categoryLabel: business.categoryLabel,
            address: business.address,
            phone: business.phone,
            website: business.website,
            hasWebsite: business.hasWebsite,
            lat: business.lat,
            lon: business.lon,
            city: business.city,
            state: business.state,
            postcode: business.postcode,
            country: business.country,
            allCategories: business.allCategories,
            rating: business.rating,
            reviewCount: business.reviewCount,
            leadScore: business.leadScore,
            contactSource: business.contactSource,
            lastSeenAt: new Date(),
          },
        });

        await tx.searchResult.create({
          data: {
            searchId: pendingSearch.id,
            businessPlaceId: business.placeId,
          },
        });
      }

      await tx.search.update({
        where: {
          id: pendingSearch.id,
        },
        data: {
          status: "COMPLETED",
          resultsCount: preparedBusinesses.length,
          newResultsCount: newIds.length,
          existingResultsCount: existingIdsForResponse.length,
          withPhoneCount: preparedBusinesses.filter((business) => Boolean(business.phone)).length,
          apiCalls,
          staleAfterAt,
        },
      });
    }, {
      maxWait: 10_000,
      timeout: 60_000,
    });

    const [newBusinesses, existingBusinesses, completedSearch] = await Promise.all([
      mapBusinessesByPlaceIds(newIds),
      mapBusinessesByPlaceIds(existingIdsForResponse),
      prisma.search.findUniqueOrThrow({
        where: { id: pendingSearch.id },
      }),
    ]);

    return {
      reused: false,
      message:
        args.searchMode === "NAME_FALLBACK"
          ? "Busqueda aproximada completada. Revisa los resultados con cuidado porque la precision es menor."
          : "Busqueda completada y deduplicada contra el historial guardado.",
      summary: {
        searchId: completedSearch.id,
        status: completedSearch.status,
        searchMode: completedSearch.searchMode,
        queryTextOriginal: completedSearch.queryTextOriginal,
        queryCategory: completedSearch.queryCategory,
        locationLabel: completedSearch.locationLabel,
        executedAt: completedSearch.executedAt.toISOString(),
        staleAfterAt: completedSearch.staleAfterAt?.toISOString() ?? null,
        reusedFromSearchId: completedSearch.reusedFromSearchId,
        reusedFromExecutedAt: null,
        resultsCount: completedSearch.resultsCount,
        newResultsCount: completedSearch.newResultsCount,
        existingResultsCount: completedSearch.existingResultsCount,
        provider: completedSearch.provider,
        withPhoneCount: completedSearch.withPhoneCount,
        apiCalls: completedSearch.apiCalls,
        isRefresh: completedSearch.isRefresh,
        errorCode: completedSearch.errorCode,
        errorMessage: completedSearch.errorMessage,
      },
      newBusinesses,
      existingBusinesses,
    };
  } catch (error) {
    await prisma.search.update({
      where: { id: pendingSearch.id },
      data: {
        status: "FAILED",
        errorCode: error instanceof GeoapifyError ? error.code : "UNKNOWN_ERROR",
        errorMessage:
          error instanceof Error ? error.message : "Ocurrio un error inesperado al ejecutar la busqueda.",
      },
    });

    throw error;
  }
}
