-- #186 Zero-result search fixer: rules that rewrite or redirect a search query.
-- Additive, idempotent.

CREATE TABLE IF NOT EXISTS "SearchRule" (
  "id"          TEXT NOT NULL,
  "query"       TEXT NOT NULL,
  "kind"        TEXT NOT NULL DEFAULT 'REWRITE',
  "rewriteTo"   TEXT,
  "targetUrl"   TEXT,
  "note"        TEXT,
  "createdById" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SearchRule_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SearchRule_query_key" ON "SearchRule"("query");
