import { NextRequest, NextResponse } from "next/server";

import { getMapBusinesses } from "@/lib/businesses/query";
import { toErrorResponse } from "@/lib/http";
import { businessFilterSchema } from "@/lib/validators/search";

export const runtime = "nodejs";

/** Puntos mínimos del mapa; se cargan aparte del directorio paginado. */
export async function GET(request: NextRequest) {
  try {
    const filters = businessFilterSchema.parse({
      hasWebsite: request.nextUrl.searchParams.get("hasWebsite") ?? "all",
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      searchId: request.nextUrl.searchParams.get("searchId") ?? undefined,
      query: request.nextUrl.searchParams.get("query") ?? undefined,
    });

    return NextResponse.json({ businesses: await getMapBusinesses(filters) });
  } catch (error) {
    return toErrorResponse(error);
  }
}
