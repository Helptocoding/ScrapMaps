# Local Prospect Finder

Herramienta local de prospeccion de negocios para detectar comercios reales por rubro y zona, deduplicarlos entre busquedas historicas y priorizar los que no tienen sitio web.

## Objetivo

- Buscar negocios locales por rubro y ubicacion.
- Guardar historial de busquedas para no repetir trabajo.
- Deduplicar por `place_id` de Geoapify, no por nombre o direccion.
- Exportar resultados filtrados a `xlsx` o `csv`.
- Enfocar la prospeccion en negocios `sin sitio web`.

No incluye automatizacion de contacto, envios masivos, WhatsApp, email ni scraping agresivo. La herramienta sirve para investigacion, organizacion y exportacion manual de prospectos.

## Stack

- `Next.js 16` con App Router y Route Handlers
- `TypeScript`
- `Prisma ORM`
- `SQLite` en local
- `TanStack Table`
- `exceljs`
- `zod`

## Decisiones de arquitectura

### 1. Dedupe central por `place_id`

- Cada negocio vive una sola vez en `Business`.
- La identidad se resuelve con `place_id` de Geoapify.
- La relacion `SearchResult` registra en que busquedas aparecio cada negocio.
- Si una zona se solapa con otra, el negocio no se vuelve a insertar: solo se agrega una nueva fila en `SearchResult`.

### 2. Cache de busquedas identicas

- Se calcula un `fingerprint` con:
  - workspace
  - modo de busqueda
  - categoria resuelta o texto original
  - `geocodePlaceId` o coordenadas redondeadas
  - radio
- Si existe una busqueda `COMPLETED` con el mismo fingerprint y sigue vigente, se crea un registro `REUSED` y se reaprovechan los resultados.
- El TTL por defecto es `7` dias y se controla con `SEARCH_CACHE_TTL_DAYS`.
- Importante: una busqueda `REUSED` no extiende el `staleAfterAt` de la busqueda original.

### 3. API key BYOK con confidencialidad real

- La API key de Geoapify no se guarda en base de datos.
- Se almacena en cookie `httpOnly` cifrada con `AES-256-GCM` usando `APP_SECRET`.
- La cookie no queda accesible desde JavaScript del navegador.
- La app valida la key antes de guardarla.

### 4. Geocodificacion con confirmacion explicita

- No se ejecuta la busqueda de negocios automaticamente con el primer resultado de geocoding.
- Primero se muestran candidatos de ubicacion y el usuario confirma la correcta.
- Esto evita buscar en una ciudad equivocada cuando el texto es ambiguo.

### 5. Rubros curados + fallback aproximado

- Flujo principal: diccionario local de rubros comunes hacia categorias Geoapify.
- Si no hay match exacto, la UI primero sugiere rubros soportados.
- Solo como segunda opcion, el usuario puede lanzar una `busqueda aproximada`.
- Esa busqueda usa `name=<texto libre>` y categorias amplias de Places API, por lo que se marca visualmente como menos precisa.

## Modelo de datos

### `Business`

- `placeId` como PK
- `name`, `primaryCategory`, `categoryLabel`
- `address`, `phone`, `website`, `hasWebsite`
- `lat`, `lon`
- `city`, `state`, `postcode`, `country`
- `allCategories`, `lastSeenAt`, timestamps

### `Search`

- guarda rubro original y categoria resuelta
- guarda ubicacion confirmada, centro, radio y fingerprint
- guarda estado: `PENDING`, `COMPLETED`, `REUSED`, `FAILED`
- guarda conteos de nuevos/existentes
- guarda `staleAfterAt` para la politica de cache

### `SearchResult`

- tabla intermedia `search_id + business_place_id`
- registra en que busquedas aparecio cada negocio

## Estructura

```text
src/
  app/
    api/
      businesses/
      export/
      search/
      searches/
      session/
    globals.css
    layout.tsx
    page.tsx
  components/
    business-table.tsx
    dashboard.tsx
  lib/
    businesses/
    categories/
    export/
    geoapify/
    search/
    security/
    validators/
  types/
prisma/
  schema.prisma
  seed.ts
```

## Variables de entorno

Usa `.env` basado en `.env.example`:

```env
DATABASE_URL="file:./dev.db"
APP_SECRET="una-clave-larga-de-32-caracteres-o-mas"
SEARCH_CACHE_TTL_DAYS="7"
```

## Puesta en marcha

```bash
npm install
npx prisma migrate dev --name init
npm run dev
```

Abrir `http://localhost:3000`.

## Exportacion

- `GET /api/export/xlsx`
- `GET /api/export/csv`

Ambos respetan los filtros activos enviados por query string:

- `hasWebsite=all|yes|no`
- `category=<primaryCategory>`
- `searchId=<searchId>`

## Manejo de errores

- `401/403` de Geoapify: key invalida o sin permisos
- `429`: rate limit
- `500`: error inesperado o upstream no controlado
- validaciones de UI y API hechas con `zod`

## Nota sobre Geoapify y uso comercial

Revision de documentacion publica al momento de construir esta v1:

- Geoapify permite uso comercial del plan gratuito con limitaciones.
- El plan gratuito exige atribucion de Geoapify cuando aplica.
- Los terminos publicos revisados no mostraron una ventana fija de retencion de datos estilo "solo puedes almacenarlos X dias".
- Aun asi, antes de pasar a produccion comercial conviene revalidar terminos vigentes, atribucion requerida y cualquier restriccion nueva sobre almacenamiento o redistribucion.

Fuentes revisadas:

- `https://www.geoapify.com/terms-and-conditions/`
- `https://www.geoapify.com/pricing/`
- `https://apidocs.geoapify.com/docs/places/`
- `https://apidocs.geoapify.com/docs/geocoding/forward-geocoding/`

## Roadmap natural despues de esta v1

1. Analisis basico de calidad de sitio web.
2. Notas manuales por negocio.
3. Multiusuario real sobre el modelo `Workspace`.
4. Migracion de `SQLite` a `Postgres` cambiando el provider de Prisma.
