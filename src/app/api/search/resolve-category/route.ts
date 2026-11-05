import { NextResponse } from "next/server";
import { z } from "zod";

import { toErrorResponse } from "@/lib/http";
import { resolveCategory } from "@/lib/categories/resolver";

const schema = z.object({
  queryTextOriginal: z.string().trim().min(2),
});

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload = schema.parse(await request.json());
    return NextResponse.json(resolveCategory(payload.queryTextOriginal));
  } catch (error) {
    return toErrorResponse(error);
  }
}
