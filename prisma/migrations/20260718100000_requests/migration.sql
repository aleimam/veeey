-- Requests epic (Phase A) — the unified purchasing-request queue mirroring
-- YeldnIN's Request model. Additive; idempotent CREATE TABLE so a re-run and a
-- fresh store (veeey.net) both apply cleanly. Money = piastres (BigInt).

CREATE TABLE IF NOT EXISTS "Request" (
  "id"              TEXT NOT NULL,
  "uid"             TEXT,
  "type"            TEXT NOT NULL,
  "scope"           TEXT NOT NULL DEFAULT 'EGV',
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "customerId"      TEXT,
  "orderId"         TEXT,
  "notes"           TEXT,
  "depositPiastres" BIGINT,
  "autoOptional"    BOOLEAN NOT NULL DEFAULT false,
  "approvedById"    TEXT,
  "approvedByName"  TEXT,
  "approvedAt"      TIMESTAMP(3),
  "rejectedNote"    TEXT,
  "archivedAt"      TIMESTAMP(3),
  "requestedById"   TEXT,
  "requestedByName" TEXT,
  "outboxEventId"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Request_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Request_uid_key" ON "Request" ("uid");
CREATE INDEX IF NOT EXISTS "Request_type_idx" ON "Request" ("type");
CREATE INDEX IF NOT EXISTS "Request_status_idx" ON "Request" ("status");
CREATE INDEX IF NOT EXISTS "Request_customerId_idx" ON "Request" ("customerId");
CREATE INDEX IF NOT EXISTS "Request_orderId_idx" ON "Request" ("orderId");

CREATE TABLE IF NOT EXISTS "RequestLine" (
  "id"                   TEXT NOT NULL,
  "requestId"            TEXT NOT NULL,
  "productId"            TEXT NOT NULL,
  "count"                INTEGER NOT NULL DEFAULT 1,
  "sellingPricePiastres" BIGINT,
  "notes"                TEXT,
  CONSTRAINT "RequestLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RequestLine_requestId_idx" ON "RequestLine" ("requestId");
CREATE INDEX IF NOT EXISTS "RequestLine_productId_idx" ON "RequestLine" ("productId");

CREATE TABLE IF NOT EXISTS "RequestPhoto" (
  "id"        TEXT NOT NULL,
  "requestId" TEXT NOT NULL,
  "url"       TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RequestPhoto_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RequestPhoto_requestId_idx" ON "RequestPhoto" ("requestId");

-- Foreign keys (guarded: skip if already present, e.g. a partial re-run).
DO $$ BEGIN
  ALTER TABLE "Request" ADD CONSTRAINT "Request_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Request" ADD CONSTRAINT "Request_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RequestLine" ADD CONSTRAINT "RequestLine_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RequestLine" ADD CONSTRAINT "RequestLine_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "RequestPhoto" ADD CONSTRAINT "RequestPhoto_requestId_fkey"
    FOREIGN KEY ("requestId") REFERENCES "Request" ("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
