/**
 * Proxy de recursos de mapa de Geoapify.
 *
 * La API key vive en una cookie AES-256-GCM httpOnly y nunca toca el cliente.
 * MapLibre, en cambio, pide tiles / glyphs / sprites desde el browser: si le
 * pasáramos el style.json de Geoapify tal cual, la key viajaría en cada una
 * de esas URLs. Por eso el servidor busca el estilo, reescribe cada URL hacia
 * este proxy y agrega la key recién en la request saliente.
 *
 * Reescribir solo los tiles no alcanza: el style.json también trae la key en
 * `glyphs`, `sprite` y `sources[*].url`.
 */

const UPSTREAM_ORIGIN = "https://maps.geoapify.com";

export const MAP_STYLE_ID = "osm-bright-smooth";

/** Ruta interna que sirve cualquier recurso upstream. */
export const ASSET_ROUTE = "/api/map/asset";

/**
 * Los placeholders (`{z}`, `{fontstack}`, …) se dejan SIN codificar a propósito:
 * MapLibre los sustituye por reemplazo literal de texto sobre el template, así
 * que si estuvieran percent-encoded no los encontraría.
 */
export function toProxyUrl(upstreamUrl: string) {
  const withoutQuery = upstreamUrl.split("?")[0];
  return `${ASSET_ROUTE}?u=${withoutQuery}`;
}

/**
 * Guard anti-SSRF: sin esto el handler sería un proxy abierto capaz de alcanzar
 * cualquier host, incluida la red local de quien corre la app.
 */
export function resolveUpstreamUrl(rawUrl: string | null, apiKey: string) {
  if (!rawUrl) return null;

  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.origin !== UPSTREAM_ORIGIN) return null;

  parsed.searchParams.set("apiKey", apiKey);
  return parsed.toString();
}

type StyleJson = {
  glyphs?: string;
  sprite?: string;
  sources?: Record<string, { url?: string; tiles?: string[] }>;
};

/** Reemplaza toda URL upstream del style.json por su equivalente proxeada. */
export function rewriteStyle(style: StyleJson) {
  const rewritten: StyleJson = { ...style };

  if (typeof style.glyphs === "string") {
    rewritten.glyphs = toProxyUrl(style.glyphs);
  }

  if (typeof style.sprite === "string") {
    rewritten.sprite = toProxyUrl(style.sprite);
  }

  if (style.sources) {
    rewritten.sources = Object.fromEntries(
      Object.entries(style.sources).map(([name, source]) => [
        name,
        {
          ...source,
          ...(typeof source.url === "string" ? { url: toProxyUrl(source.url) } : {}),
          ...(Array.isArray(source.tiles) ? { tiles: source.tiles.map(toProxyUrl) } : {}),
        },
      ]),
    );
  }

  return rewritten;
}

export function buildStyleUrl() {
  return `${UPSTREAM_ORIGIN}/v1/styles/${MAP_STYLE_ID}/style.json`;
}
