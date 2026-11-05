import { z } from "zod";

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_SECRET: z.string().min(32, "APP_SECRET must be at least 32 characters long."),
  SEARCH_CACHE_TTL_DAYS: z.coerce.number().int().min(1).max(30).default(7),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

const parsed = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  APP_SECRET: process.env.APP_SECRET,
  SEARCH_CACHE_TTL_DAYS: process.env.SEARCH_CACHE_TTL_DAYS ?? "7",
  NODE_ENV: process.env.NODE_ENV ?? "development",
});

if (!parsed.success) {
  throw new Error(`Invalid environment configuration: ${parsed.error.message}`);
}

export const env = parsed.data;
