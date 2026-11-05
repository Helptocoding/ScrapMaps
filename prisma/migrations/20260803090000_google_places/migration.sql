-- Add provider-aware identifiers and lead quality metadata.
ALTER TABLE "businesses" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'GEOAPIFY';
ALTER TABLE "businesses" ADD COLUMN "external_place_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "businesses" ADD COLUMN "rating" REAL;
ALTER TABLE "businesses" ADD COLUMN "review_count" INTEGER;
ALTER TABLE "businesses" ADD COLUMN "lead_score" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "businesses" ADD COLUMN "contact_source" TEXT;

UPDATE "businesses" SET "external_place_id" = "place_id" WHERE "external_place_id" = '';

ALTER TABLE "searches" ADD COLUMN "provider" TEXT NOT NULL DEFAULT 'GEOAPIFY';
ALTER TABLE "searches" ADD COLUMN "with_phone_count" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "searches" ADD COLUMN "api_calls" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "businesses_provider_external_place_id_idx" ON "businesses"("provider", "external_place_id");
CREATE INDEX "businesses_lead_score_idx" ON "businesses"("lead_score");
