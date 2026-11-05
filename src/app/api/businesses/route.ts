import { NextRequest, NextResponse } from "next/server";

import { getBusinessPage, getFilterOptions } from "@/lib/businesses/query";
import { toErrorResponse } from "@/lib/http";
import { businessFilterSchema } from "@/lib/validators/search";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const parsed = businessFilterSchema.parse({
      hasWebsite: request.nextUrl.searchParams.get("hasWebsite") ?? "all",
      category: request.nextUrl.searchParams.get("category") ?? undefined,
      searchId: request.nextUrl.searchParams.get("searchId") ?? undefined,
      query: request.nextUrl.searchParams.get("query") ?? undefined,
      page: request.nextUrl.searchParams.get("page") ?? undefined,
      pageSize: request.nextUrl.searchParams.get("pageSize") ?? undefined,
    });

    const [businessPage, filters] = await Promise.all([
      getBusinessPage(parsed, { page: parsed.page, pageSize: parsed.pageSize }),
      getFilterOptions(),
    ]);

    return NextResponse.json({
      ...businessPage,
      categories: filters.categories,
      searches: filters.searches.map((search: (typeof filters.searches)[number]) => ({
        ...search,
        executedAt: search.executedAt.toISOString(),
      })),
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
