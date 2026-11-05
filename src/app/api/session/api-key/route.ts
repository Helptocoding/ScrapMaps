import { NextResponse } from "next/server";
import { z } from "zod";

import { validateGeoapifyApiKey } from "@/lib/geoapify/client";
import { toErrorResponse } from "@/lib/http";
import {
  API_PROVIDERS,
  clearApiKey,
  getApiKeyConfiguration,
  setApiKey,
  type ApiProvider,
} from "@/lib/security/api-key-cookie";
import { apiKeySchema } from "@/lib/validators/search";

export const runtime = "nodejs";

const providerSchema = z.object({
  provider: z.enum(API_PROVIDERS),
});

const providerApiKeySchema = providerSchema.extend(apiKeySchema.shape);

export async function GET() {
  return NextResponse.json({ providers: await getApiKeyConfiguration() });
}

export async function POST(request: Request) {
  try {
    const payload = providerApiKeySchema.parse(await request.json());

    if (payload.provider === "geoapify") {
      await validateGeoapifyApiKey(payload.apiKey);
    }

    await setApiKey(payload.provider, payload.apiKey);

    return NextResponse.json({
      message:
        payload.provider === "geoapify"
          ? "Geoapify fue validada y guardada de forma cifrada."
          : payload.provider === "googlePlaces"
            ? "Google Places fue guardada de forma cifrada y ya está disponible para buscar."
            : "La clave fue guardada de forma cifrada para usar esta fuente más adelante.",
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { provider } = providerSchema.parse(await request.json());
    await clearApiKey(provider as ApiProvider);
    return NextResponse.json({ message: "La clave fue eliminada de esta sesión." });
  } catch (error) {
    return toErrorResponse(error);
  }
}
