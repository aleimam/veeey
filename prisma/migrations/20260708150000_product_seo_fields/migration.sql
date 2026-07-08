-- Full SEO module fields (RankMath-style editor) — bilingual focus keywords,
-- social meta, indexing controls, editable Product schema overrides.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "focusKeywordEn" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "focusKeywordAr" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "secondaryKeywordsEn" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "secondaryKeywordsAr" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ogTitleEn" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ogTitleAr" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ogDescEn" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ogDescAr" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "ogImage" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "canonicalUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "robotsIndex" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "robotsFollow" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "schemaOverridesJson" JSONB;
