-- Collection V3 (V3-COL-1): structured rule engine, manual product ordering,
-- and banner alt text. descriptionAr + meta title/desc already exist.
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "ruleJson" JSONB;
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "manualOrder" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "imageAltEn" TEXT;
ALTER TABLE "Collection" ADD COLUMN IF NOT EXISTS "imageAltAr" TEXT;
