import { NextRequest, NextResponse } from "next/server";

import { resolveUpstreamUrl } from "@/lib/geoapify/map-proxy";
import { getGeoapifyApiKey } from "@/lib/security/api-key-cookie";

export const runtime = "nodejs";

/**
 * Passthrough de tiles, glyphs y sprites.
 *
 * `resolveUpstreamUrl` solo acepta el origen de Geoapify: sin esa validación
 * el handler sería un proxy abierto hacia cualquier host.
 */
export async function GET(request: NextRequest) {
  const apiKey = await getGeoapifyApiKey();

  if (!apiKey) {
    return new NextResponse(null, { status: 503 });
  }

  const upstream = resolveUpstreamUrl(request.nextUrl.searchParams.get("u"), apiKey);

  if (!upstream) {
    return new NextResponse(null, { status: 400 });
  }

  const response = await fetch(upstream, { cache: "no-store" });

  if (!response.ok) {
    return new NextResponse(null, { status: response.status });
  }

  return new NextResponse(response.body, {
    status: response.status,
    headers: {
      "Content-Type": response.headers.get("Content-Type") ?? "application/octet-stream",
      // Los tiles son inmutables: el browser no vuelve a pedirlos y el proxy
      // deja de estar en el camino crítico salvo la primera vez.
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
