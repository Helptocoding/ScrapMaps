import { createHash } from "node:crypto";

import { roundCoordinate } from "@/lib/utils";
import type { SearchMode, SearchProvider } from "@/types/app";

export function buildSearchFingerprint(args: {
  workspaceId: string;
  provider: SearchProvider;
  searchMode: SearchMode;
  queryCategory: string | null;
  queryTextOriginal: string;
  geocodePlaceId: string | null;
  centerLat: number;
  centerLon: number;
  radiusMeters: number;
}) {
  const payload = [
    args.workspaceId,
    args.provider,
    args.searchMode,
    args.queryCategory ?? "fallback",
    args.queryTextOriginal.trim().toLowerCase(),
    args.geocodePlaceId ?? `${roundCoordinate(args.centerLat)}:${roundCoordinate(args.centerLon)}`,
    args.radiusMeters,
  ].join("|");

  return createHash("sha256").update(payload).digest("hex");
}
