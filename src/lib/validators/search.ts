import { z } from "zod";

export const apiKeySchema = z.object({
  apiKey: z.string().trim().min(10),
});

export const resolveLocationSchema = z.object({
  provider: z.enum(["GEOAPIFY", "GOOGLE"]).default("GOOGLE"),
  locationQuery: z.string().trim().min(2, "Escribe una ubicacion valida."),
});

export const runSearchSchema = z.object({
  provider: z.enum(["GEOAPIFY", "GOOGLE"]).default("GOOGLE"),
  queryTextOriginal: z.string().trim().min(2),
  queryCategory: z.string().trim().nullable(),
  searchMode: z.enum(["CATEGORY", "NAME_FALLBACK"]),
  locationQuery: z.string().trim().min(2),
  locationLabel: z.string().trim().min(2),
  geocodePlaceId: z.string().trim().nullable(),
  centerLat: z.number().min(-90).max(90),
  centerLon: z.number().min(-180).max(180),
  radiusMeters: z.number().int().min(500).max(50000),
  forceRefresh: z.boolean().default(false),
});

export const businessFilterSchema = z.object({
  hasWebsite: z.enum(["all", "yes", "no"]).default("all"),
  category: z.string().trim().optional(),
  searchId: z.string().trim().optional(),
  query: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(50).default(12),
});
