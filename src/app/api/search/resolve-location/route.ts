import { NextResponse } from "next/server";

import { resolveLocationCandidates } from "@/lib/geoapify/client";
import { resolveGoogleLocation } from "@/lib/google-places/client";
import { toErrorResponse } from "@/lib/http";
import { getApiKey } from "@/lib/security/api-key-cookie";
import { resolveLocationSchema } from "@/lib/validators/search";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = resolveLocationSchema.parse(await request.json());
    const apiKey = await getApiKey(payload.provider === "GOOGLE" ? "googlePlaces" : "geoapify");
    if (!apiKey) {
      const source = payload.provider === "GOOGLE" ? "Google Places" : "Geoapify";
      return NextResponse.json({ error: `Configura tu API key de ${source} antes de buscar.` }, { status: 401 });
    }

    const candidates =
      payload.provider === "GOOGLE"
        ? await resolveGoogleLocation({ apiKey, locationQuery: payload.locationQuery })
        : await resolveLocationCandidates(apiKey, payload.locationQuery);
    return NextResponse.json({ candidates });
  } catch (error) {
    return toErrorResponse(error);
  }
}
