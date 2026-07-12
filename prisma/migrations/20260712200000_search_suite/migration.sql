-- Search analytics + synonyms + fuzzy (pg_trgm).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS "SearchQuery" (
  "id" TEXT NOT NULL,
  "term" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "resultCount" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'results',
  "sessionId" TEXT,
  "customerId" TEXT,
  "locale" TEXT NOT NULL DEFAULT 'en',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchQuery_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SearchQuery_normalized_idx" ON "SearchQuery"("normalized");
CREATE INDEX IF NOT EXISTS "SearchQuery_createdAt_idx" ON "SearchQuery"("createdAt");
CREATE INDEX IF NOT EXISTS "SearchQuery_sessionId_idx" ON "SearchQuery"("sessionId");

CREATE TABLE IF NOT EXISTS "SearchClick" (
  "id" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "productId" TEXT,
  "position" INTEGER NOT NULL DEFAULT 0,
  "source" TEXT NOT NULL DEFAULT 'results',
  "sessionId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchClick_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SearchClick_normalized_idx" ON "SearchClick"("normalized");
CREATE INDEX IF NOT EXISTS "SearchClick_productId_idx" ON "SearchClick"("productId");
CREATE INDEX IF NOT EXISTS "SearchClick_createdAt_idx" ON "SearchClick"("createdAt");

CREATE TABLE IF NOT EXISTS "SearchSynonym" (
  "id" TEXT NOT NULL,
  "normalized" TEXT NOT NULL,
  "synonyms" TEXT[] NOT NULL DEFAULT '{}',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SearchSynonym_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SearchSynonym_normalized_key" ON "SearchSynonym"("normalized");

-- Trigram indexes to make similarity() searches fast.
CREATE INDEX IF NOT EXISTS "Product_nameEn_trgm_idx" ON "Product" USING gin (lower("nameEn") gin_trgm_ops);
CREATE INDEX IF NOT EXISTS "Product_nameAr_trgm_idx" ON "Product" USING gin ("nameAr" gin_trgm_ops);
