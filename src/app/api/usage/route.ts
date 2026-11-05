import { NextResponse } from "next/server";

import { getApiUsageSummary } from "@/lib/businesses/query";
import { toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ usage: await getApiUsageSummary() });
  } catch (error) {
    return toErrorResponse(error);
  }
}
