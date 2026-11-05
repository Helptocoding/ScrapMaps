import { NextResponse } from "next/server";

import { toErrorResponse } from "@/lib/http";
import { getApiKey } from "@/lib/security/api-key-cookie";
import { runBusinessSearch } from "@/lib/search/service";
import { runSearchSchema } from "@/lib/validators/search";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = runSearchSchema.parse(await request.json());
    const apiKey = await getApiKey(payload.provider === "GOOGLE" ? "googlePlaces" : "geoapify");
    if (!apiKey) {
      const source = payload.provider === "GOOGLE" ? "Google Places" : "Geoapify";
      return NextResponse.json({ error: `Configura tu API key de ${source} antes de buscar.` }, { status: 401 });
    }

    const result = await runBusinessSearch({ ...payload, apiKey });
    return NextResponse.json(result);
  } catch (error) {
    return toErrorResponse(error);
  }
}
