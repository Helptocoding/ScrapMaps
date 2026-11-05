export type SearchStatus = "PENDING" | "COMPLETED" | "REUSED" | "FAILED";
export type SearchMode = "CATEGORY" | "NAME_FALLBACK";
export type SearchProvider = "GEOAPIFY" | "GOOGLE";

export type CategoryOption = {
  key: string;
  label: string;
  geoapifyCategory: string;
  aliases: string[];
};

export type CategoryResolution = {
  matched: boolean;
  match?: CategoryOption;
  suggestions: CategoryOption[];
};

export type LocationCandidate = {
  placeId: string | null;
  label: string;
  lat: number;
  lon: number;
  resultType: string;
  confidence: number;
  city?: string | null;
  state?: string | null;
  country?: string | null;
};

export type SearchSummary = {
  searchId: string;
  status: SearchStatus;
  searchMode: SearchMode;
  provider: SearchProvider;
  queryTextOriginal: string;
  queryCategory: string | null;
  locationLabel: string;
  executedAt: string;
  staleAfterAt: string | null;
  reusedFromSearchId: string | null;
  reusedFromExecutedAt: string | null;
  resultsCount: number;
  newResultsCount: number;
  existingResultsCount: number;
  withPhoneCount: number;
  apiCalls: number;
  isRefresh: boolean;
  errorCode: string | null;
  errorMessage: string | null;
};

export type BusinessRecord = {
  placeId: string;
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
  country: string | null;
  rating: number | null;
  reviewCount: number | null;
  leadScore: number;
  contactSource: string | null;
  searchCount: number;
  searchLabels: string[];
};

/** Datos mínimos para explorar el mapa, sin cargar el directorio completo. */
export type MapBusinessPoint = Pick<BusinessRecord, "placeId" | "name" | "lat" | "lon" | "website">;

export type BusinessPage = {
  businesses: BusinessRecord[];
  total: number;
  noWebsiteCount: number;
  page: number;
  pageSize: number;
};

export type SearchRunResponse = {
  summary: SearchSummary;
  reused: boolean;
  message: string;
  newBusinesses: BusinessRecord[];
  existingBusinesses: BusinessRecord[];
};

export type ApiUsageSummary = {
  provider: SearchProvider;
  callsToday: number;
  callsThisMonth: number;
  searchesToday: number;
  searchesThisMonth: number;
};
