import { NextRequest } from "next/server";

import { getBusinesses } from "@/lib/businesses/query";
import { buildCsv } from "@/lib/export/csv";
import { toErrorResponse } from "@/lib/http";
import { businessFilterSchema } from "@/lib/validators/search";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const filters = businessFilterSchema.parse({
      hasWebsite: request.nextUrl.searchParams.get("hasWebsite") ?? "all",
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      searchId: request.nextUrl.searchParams.get("searchId") ?? undefined,
    });

    const rows = await getBusinesses(filters);
    const csv = buildCsv(rows);

    return new Response(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": 'attachment; filename="prospectos.csv"',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
