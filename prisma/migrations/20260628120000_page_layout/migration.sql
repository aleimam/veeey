-- Composable landing pages (homepage-builder blocks on arbitrary URLs).
CREATE TABLE IF NOT EXISTS "PageLayout" (
  "id"        TEXT NOT NULL,
  "slug"      TEXT NOT NULL,
  "titleEn"   TEXT NOT NULL,
  "titleAr"   TEXT,
  "status"    TEXT NOT NULL DEFAULT 'DRAFT',
  "blocks"    JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PageLayout_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PageLayout_slug_key" ON "PageLayout" ("slug");
