import { NextResponse } from "next/server";

import { getSearchHistory } from "@/lib/businesses/query";
import { toErrorResponse } from "@/lib/http";

export const runtime = "nodejs";

export async function GET() {
  try {
    return NextResponse.json({ searches: await getSearchHistory() });
  } catch (error) {
    return toErrorResponse(error);
  }
}
