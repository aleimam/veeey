-- Attribute V3 (V3-ATTR-1): multi-select input type, multi-type "applies to",
-- description/unit, facet + required flags; AttributeValue slug + sort order.
DO $$ BEGIN
  CREATE TYPE "AttributeInputType" AS ENUM ('SINGLE_SELECT', 'MULTI_SELECT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "Attribute" ADD COLUMN IF NOT EXISTS "kinds" "ProductKind"[] NOT NULL DEFAULT ARRAY[]::"ProductKind"[];
ALTER TABLE "Attribute" ADD COLUMN IF NOT EXISTS "inputType" "AttributeInputType" NOT NULL DEFAULT 'SINGLE_SELECT';
ALTER TABLE "Attribute" ADD COLUMN IF NOT EXISTS "descriptionEn" TEXT;
ALTER TABLE "Attribute" ADD COLUMN IF NOT EXISTS "descriptionAr" TEXT;
ALTER TABLE "Attribute" ADD COLUMN IF NOT EXISTS "unit" TEXT;
ALTER TABLE "Attribute" ADD COLUMN IF NOT EXISTS "isFilterable" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Attribute" ADD COLUMN IF NOT EXISTS "isRequired" BOOLEAN NOT NULL DEFAULT false;

-- Seed the new multi "applies to" from the legacy single kind.
UPDATE "Attribute" SET "kinds" = ARRAY["kind"]::"ProductKind"[] WHERE "kinds" = ARRAY[]::"ProductKind"[];

ALTER TABLE "AttributeValue" ADD COLUMN IF NOT EXISTS "slug" TEXT;
ALTER TABLE "AttributeValue" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- Seed value slugs from the English value (service regenerates on next save).
UPDATE "AttributeValue"
   SET "slug" = trim(both '-' from lower(regexp_replace(trim("valueEn"), '[^a-zA-Z0-9]+', '-', 'g')))
 WHERE "slug" IS NULL;
