import { NextRequest } from "next/server";

import { getBusinesses } from "@/lib/businesses/query";
import { buildXlsx } from "@/lib/export/xlsx";
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
    const xlsx = await buildXlsx(rows);

    return new Response(xlsx, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": 'attachment; filename="prospectos.xlsx"',
      },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
