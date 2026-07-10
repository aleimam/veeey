-- INV-P2: local reorder request + ignore-list tables for the Inventory
-- "Requests (To-buy)" feature. Additive, non-destructive, idempotent.

CREATE TABLE IF NOT EXISTS "PurchaseRequest" (
  "id"              TEXT NOT NULL,
  "productId"       TEXT NOT NULL,
  "qtyRequested"    INTEGER NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'PENDING',
  "note"            TEXT,
  "requestedById"   TEXT,
  "requestedByName" TEXT,
  "outboxEventId"   TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PurchaseRequest_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "PurchaseRequest"
    ADD CONSTRAINT "PurchaseRequest_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "PurchaseRequest_productId_idx" ON "PurchaseRequest"("productId");
CREATE INDEX IF NOT EXISTS "PurchaseRequest_status_idx" ON "PurchaseRequest"("status");

CREATE TABLE IF NOT EXISTS "ReorderIgnore" (
  "id"            TEXT NOT NULL,
  "productId"     TEXT NOT NULL,
  "snoozeUntil"   TIMESTAMP(3),
  "stockAtIgnore" INTEGER,
  "reason"        TEXT,
  "ignoredById"   TEXT,
  "ignoredByName" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ReorderIgnore_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "ReorderIgnore"
    ADD CONSTRAINT "ReorderIgnore_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "ReorderIgnore_productId_key" ON "ReorderIgnore"("productId");
