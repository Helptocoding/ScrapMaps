import { NextResponse } from "next/server";

import { validateGeoapifyApiKey } from "@/lib/geoapify/client";
import { toErrorResponse } from "@/lib/http";
import { clearGeoapifyApiKey, hasGeoapifyApiKey, setGeoapifyApiKey } from "@/lib/security/api-key-cookie";
import { apiKeySchema } from "@/lib/validators/search";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({ configured: await hasGeoapifyApiKey() });
}

export async function POST(request: Request) {
  try {
    const payload = apiKeySchema.parse(await request.json());
    await validateGeoapifyApiKey(payload.apiKey);
    await setGeoapifyApiKey(payload.apiKey);

    return NextResponse.json({ message: "API key validada y guardada de forma cifrada." });
  } catch (error) {
    return toErrorResponse(error);
  }
}

export async function DELETE() {
  try {
    await clearGeoapifyApiKey();
    return NextResponse.json({ message: "API key eliminada de la sesion local." });
  } catch (error) {
    return toErrorResponse(error);
  }
}
