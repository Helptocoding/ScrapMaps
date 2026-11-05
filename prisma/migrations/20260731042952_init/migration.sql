-- CreateTable
CREATE TABLE "workspaces" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "businesses" (
    "place_id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "primary_category" TEXT NOT NULL,
    "category_label" TEXT,
    "address" TEXT NOT NULL,
    "phone" TEXT,
    "website" TEXT,
    "has_website" BOOLEAN NOT NULL DEFAULT false,
    "lat" REAL NOT NULL,
    "lon" REAL NOT NULL,
    "city" TEXT,
    "state" TEXT,
    "postcode" TEXT,
    "country" TEXT,
    "all_categories" TEXT,
    "last_seen_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "searches" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspace_id" TEXT NOT NULL,
    "query_text_original" TEXT NOT NULL,
    "query_category" TEXT,
    "search_mode" TEXT NOT NULL DEFAULT 'CATEGORY',
    "location_query" TEXT NOT NULL,
    "location_label" TEXT NOT NULL,
    "geocode_place_id" TEXT,
    "center_lat" REAL NOT NULL,
    "center_lon" REAL NOT NULL,
    "radius_meters" INTEGER NOT NULL,
    "fingerprint" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "executed_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "results_count" INTEGER NOT NULL DEFAULT 0,
    "new_results_count" INTEGER NOT NULL DEFAULT 0,
    "existing_results_count" INTEGER NOT NULL DEFAULT 0,
    "is_refresh" BOOLEAN NOT NULL DEFAULT false,
    "reused_from_search_id" TEXT,
    "stale_after_at" DATETIME,
    "error_code" TEXT,
    "error_message" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "searches_workspace_id_fkey" FOREIGN KEY ("workspace_id") REFERENCES "workspaces" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "searches_reused_from_search_id_fkey" FOREIGN KEY ("reused_from_search_id") REFERENCES "searches" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "search_results" (
    "search_id" TEXT NOT NULL,
    "business_place_id" TEXT NOT NULL,
    "found_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("search_id", "business_place_id"),
    CONSTRAINT "search_results_search_id_fkey" FOREIGN KEY ("search_id") REFERENCES "searches" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "search_results_business_place_id_fkey" FOREIGN KEY ("business_place_id") REFERENCES "businesses" ("place_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_name_key" ON "workspaces"("name");

-- CreateIndex
CREATE INDEX "businesses_primary_category_idx" ON "businesses"("primary_category");

-- CreateIndex
CREATE INDEX "businesses_has_website_primary_category_idx" ON "businesses"("has_website", "primary_category");

-- CreateIndex
CREATE INDEX "businesses_city_idx" ON "businesses"("city");

-- CreateIndex
CREATE INDEX "businesses_lat_lon_idx" ON "businesses"("lat", "lon");

-- CreateIndex
CREATE INDEX "searches_workspace_id_executed_at_idx" ON "searches"("workspace_id", "executed_at");

-- CreateIndex
CREATE INDEX "searches_workspace_id_fingerprint_executed_at_idx" ON "searches"("workspace_id", "fingerprint", "executed_at");

-- CreateIndex
CREATE INDEX "searches_query_category_executed_at_idx" ON "searches"("query_category", "executed_at");

-- CreateIndex
CREATE INDEX "searches_location_label_idx" ON "searches"("location_label");

-- CreateIndex
CREATE INDEX "search_results_business_place_id_idx" ON "search_results"("business_place_id");

-- CreateIndex
CREATE INDEX "search_results_found_at_idx" ON "search_results"("found_at");
