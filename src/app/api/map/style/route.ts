import { NextResponse } from "next/server";

import { buildStyleUrl, rewriteStyle } from "@/lib/geoapify/map-proxy";
import { toErrorResponse } from "@/lib/http";
import { getGeoapifyApiKey } from "@/lib/security/api-key-cookie";

export const runtime = "nodejs";

export async function GET() {
  try {
    const apiKey = await getGeoapifyApiKey();

    if (!apiKey) {
      return NextResponse.json({ error: "Configurá tu API key de Geoapify para ver el mapa." }, { status: 503 });
    }

    const upstream = new URL(buildStyleUrl());
    upstream.searchParams.set("apiKey", apiKey);

    const response = await fetch(upstream, { cache: "no-store" });

    if (!response.ok) {
      return NextResponse.json({ error: "Geoapify rechazó la solicitud del estilo del mapa." }, { status: 502 });
    }

    const style = await response.json();

    // El style.json vuelve al browser sin un solo rastro de la key.
    return NextResponse.json(rewriteStyle(style), {
      headers: { "Cache-Control": "private, max-age=300" },
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}
