import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { getCategoryLabel } from "@/lib/categories/resolver";
import type { ApiUsageSummary, BusinessPage, BusinessRecord, MapBusinessPoint, SearchProvider, SearchSummary } from "@/types/app";

type BusinessFilters = {
  hasWebsite?: "yes" | "no" | "all";
  category?: string;
  searchId?: string;
  query?: string;
};

type PageOptions = {
  page?: number;
  pageSize?: number;
};

const MAP_POINT_LIMIT = 500;

function buildBusinessWhere(filters: BusinessFilters): Prisma.BusinessWhereInput {
  const query = filters.query?.trim();

  return {
    hasWebsite:
      filters.hasWebsite === "yes"
        ? true
        : filters.hasWebsite === "no"
          ? false
          : undefined,
    primaryCategory: filters.category || undefined,
    searchResults: filters.searchId
      ? {
          some: {
            searchId: filters.searchId,
          },
        }
      : undefined,
    ...(query
      ? {
          OR: [
            { name: { contains: query } },
            { address: { contains: query } },
            { phone: { contains: query } },
            { website: { contains: query } },
            { primaryCategory: { contains: query } },
            { categoryLabel: { contains: query } },
          ],
        }
      : {}),
  };
}

async function resolveSearchFilter(filters: BusinessFilters): Promise<BusinessFilters> {
  if (!filters.searchId) return filters;

  const search = await prisma.search.findUnique({
    where: { id: filters.searchId },
    select: { reusedFromSearchId: true },
  });

  return {
    ...filters,
    searchId: search?.reusedFromSearchId ?? filters.searchId,
  };
}

function mapBusiness(record: Awaited<ReturnType<typeof getBusinessRows>>[number]): BusinessRecord {
  return {
    placeId: record.placeId,
    provider: record.provider,
    name: record.name,
    primaryCategory: record.primaryCategory,
    categoryLabel: record.categoryLabel ?? getCategoryLabel(record.primaryCategory),
    address: record.address,
    phone: record.phone,
    website: record.website,
    hasWebsite: record.hasWebsite,
    lat: record.lat,
    lon: record.lon,
    city: record.city,
    state: record.state,
    country: record.country,
    rating: record.rating,
    reviewCount: record.reviewCount,
    leadScore: record.leadScore,
    contactSource: record.contactSource,
    searchCount: record.searchResults.length,
    searchLabels: Array.from(
      new Set(record.searchResults.map((result: { search: { locationLabel: string } }) => result.search.locationLabel)),
    ),
  };
}

async function getBusinessRows(filters: BusinessFilters, page?: PageOptions) {
  const pageSize = page?.pageSize;
  const pageNumber = page?.page ?? 1;

  return prisma.business.findMany({
    where: buildBusinessWhere(filters),
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
    orderBy: [
      {
        updatedAt: "desc",
      },
      {
        name: "asc",
      },
    ],
    skip: pageSize ? (pageNumber - 1) * pageSize : undefined,
    take: pageSize,
  });
}

export async function getBusinesses(filters: BusinessFilters) {
  const resolvedFilters = await resolveSearchFilter(filters);
  const rows = await getBusinessRows(resolvedFilters);
  return rows.map(mapBusiness);
}

export async function getMapBusinesses(filters: BusinessFilters): Promise<MapBusinessPoint[]> {
  const resolvedFilters = await resolveSearchFilter(filters);
  const points = await prisma.business.findMany({
    where: buildBusinessWhere(resolvedFilters),
    select: {
      placeId: true,
      name: true,
      lat: true,
      lon: true,
      website: true,
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    take: MAP_POINT_LIMIT,
  });

  return points;
}

export async function getBusinessPage(filters: BusinessFilters, options: PageOptions = {}): Promise<BusinessPage> {
  const resolvedFilters = await resolveSearchFilter(filters);
  const page = options.page ?? 1;
  const pageSize = options.pageSize ?? 12;
  const where = buildBusinessWhere(resolvedFilters);

  const [rows, total, noWebsiteCount] = await Promise.all([
    getBusinessRows(resolvedFilters, { page, pageSize }),
    prisma.business.count({ where }),
    resolvedFilters.hasWebsite === "yes" ? Promise.resolve(0) : prisma.business.count({ where: { ...where, hasWebsite: false } }),
  ]);

  return {
    businesses: rows.map(mapBusiness),
    total,
    noWebsiteCount,
    page,
    pageSize,
  };
}

export async function getSearchHistory() {
  const searches = await prisma.search.findMany({
    orderBy: {
      executedAt: "desc",
    },
    take: 50,
    include: {
      reusedFromSearch: {
        select: {
          executedAt: true,
        },
      },
    },
  });

  return searches.map<SearchSummary>((search: (typeof searches)[number]) => ({
    searchId: search.id,
    status: search.status,
    searchMode: search.searchMode,
    provider: search.provider,
    queryTextOriginal: search.queryTextOriginal,
    queryCategory: search.queryCategory,
    locationLabel: search.locationLabel,
    executedAt: search.executedAt.toISOString(),
    staleAfterAt: search.staleAfterAt?.toISOString() ?? null,
    reusedFromSearchId: search.reusedFromSearchId,
    reusedFromExecutedAt: search.reusedFromSearch?.executedAt.toISOString() ?? null,
    resultsCount: search.resultsCount,
    newResultsCount: search.newResultsCount,
    existingResultsCount: search.existingResultsCount,
    withPhoneCount: search.withPhoneCount,
    apiCalls: search.apiCalls,
    isRefresh: search.isRefresh,
    errorCode: search.errorCode,
    errorMessage: search.errorMessage,
  }));
}

export async function getApiUsageSummary(): Promise<ApiUsageSummary[]> {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [today, month] = await Promise.all([
    prisma.search.groupBy({
      by: ["provider"],
      where: { status: "COMPLETED", executedAt: { gte: startOfToday } },
      _sum: { apiCalls: true },
      _count: { _all: true },
    }),
    prisma.search.groupBy({
      by: ["provider"],
      where: { status: "COMPLETED", executedAt: { gte: startOfMonth } },
      _sum: { apiCalls: true },
      _count: { _all: true },
    }),
  ]);

  const todayByProvider = new Map(today.map((item) => [item.provider, item]));
  const monthByProvider = new Map(month.map((item) => [item.provider, item]));

  return (["GOOGLE", "GEOAPIFY"] as const).map((provider) => {
    const day = todayByProvider.get(provider);
    const monthly = monthByProvider.get(provider);

    return {
      provider: provider as SearchProvider,
      callsToday: day?._sum.apiCalls ?? 0,
      callsThisMonth: monthly?._sum.apiCalls ?? 0,
      searchesToday: day?._count._all ?? 0,
      searchesThisMonth: monthly?._count._all ?? 0,
    };
  });
}

export async function getFilterOptions() {
  const [categories, searches] = await Promise.all([
    prisma.business.findMany({
      distinct: ["primaryCategory"],
      select: {
        primaryCategory: true,
        categoryLabel: true,
      },
      orderBy: {
        categoryLabel: "asc",
      },
    }),
    prisma.search.findMany({
      select: {
        id: true,
        locationLabel: true,
        executedAt: true,
      },
      orderBy: {
        executedAt: "desc",
      },
      take: 50,
    }),
  ]);

  return {
    categories: categories.map((category) => ({
      ...category,
      categoryLabel: category.categoryLabel ?? getCategoryLabel(category.primaryCategory),
    })),
    searches,
  };
}
