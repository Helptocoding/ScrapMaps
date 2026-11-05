import { Dashboard } from "@/components/dashboard";
import { getApiUsageSummary, getBusinessPage, getFilterOptions, getSearchHistory } from "@/lib/businesses/query";
import { CATEGORY_OPTIONS } from "@/lib/categories/dictionary";
import { env } from "@/lib/env";
import { getApiKeyConfiguration } from "@/lib/security/api-key-cookie";

export default async function Home() {
  const [businessPage, searches, filters, configuredApiKeys, usage] = await Promise.all([
    getBusinessPage({ hasWebsite: "all" }),
    getSearchHistory(),
    getFilterOptions(),
    getApiKeyConfiguration(),
    getApiUsageSummary(),
  ]);

  return (
    <Dashboard
      categories={CATEGORY_OPTIONS}
      initialBusinesses={businessPage.businesses}
      initialPagination={{
        total: businessPage.total,
        noWebsiteCount: businessPage.noWebsiteCount,
        page: businessPage.page,
        pageSize: businessPage.pageSize,
      }}
      initialSearches={searches}
      initialCategoryFilters={filters.categories}
      initialSearchFilters={filters.searches.map((search: (typeof filters.searches)[number]) => ({
        id: search.id,
        locationLabel: search.locationLabel,
        executedAt: search.executedAt.toISOString(),
      }))}
      initialApiKeyConfiguration={configuredApiKeys}
      initialApiUsage={usage}
      cacheTtlDays={env.SEARCH_CACHE_TTL_DAYS}
    />
  );
}
