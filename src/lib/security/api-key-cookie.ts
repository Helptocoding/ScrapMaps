import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

import { env } from "@/lib/env";

const ALGORITHM = "aes-256-gcm";

export const API_PROVIDERS = ["geoapify", "googlePlaces", "foursquare"] as const;
export type ApiProvider = (typeof API_PROVIDERS)[number];

const COOKIE_NAMES: Record<ApiProvider, string> = {
  geoapify: "geoapify_api_key",
  googlePlaces: "google_places_api_key",
  foursquare: "foursquare_api_key",
};

function getDerivedKey() {
  return createHash("sha256").update(env.APP_SECRET).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getDerivedKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return ["v1", iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(".");
}

function decrypt(payload: string) {
  const [version, iv, tag, content] = payload.split(".");

  if (version !== "v1" || !iv || !tag || !content) {
    throw new Error("Invalid cookie payload.");
  }

  const decipher = createDecipheriv(ALGORITHM, getDerivedKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(content, "base64url")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

export async function getApiKey(provider: ApiProvider) {
  const store = await cookies();
  const raw = store.get(COOKIE_NAMES[provider])?.value;

  if (!raw) return null;

  try {
    return decrypt(raw);
  } catch {
    return null;
  }
}

export async function getGeoapifyApiKey() {
  return getApiKey("geoapify");
}

export async function hasApiKey(provider: ApiProvider) {
  return Boolean(await getApiKey(provider));
}

export async function hasGeoapifyApiKey() {
  return hasApiKey("geoapify");
}

export async function getApiKeyConfiguration(): Promise<Record<ApiProvider, boolean>> {
  const configured = await Promise.all(API_PROVIDERS.map((provider) => hasApiKey(provider)));
  return Object.fromEntries(API_PROVIDERS.map((provider, index) => [provider, configured[index]])) as Record<ApiProvider, boolean>;
}

export async function setApiKey(provider: ApiProvider, apiKey: string) {
  const store = await cookies();

  store.set({
    name: COOKIE_NAMES[provider],
    value: encrypt(apiKey),
    httpOnly: true,
    sameSite: "lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function setGeoapifyApiKey(apiKey: string) {
  return setApiKey("geoapify", apiKey);
}

export async function clearApiKey(provider: ApiProvider) {
  const store = await cookies();
  store.set(COOKIE_NAMES[provider], "", { path: "/", maxAge: 0 });
}

export async function clearGeoapifyApiKey() {
  return clearApiKey("geoapify");
}
