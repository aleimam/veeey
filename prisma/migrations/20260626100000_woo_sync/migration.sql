-- WooCommerce live-sync: per-entity sync cursor + detach tracking (syncedAt).

ALTER TABLE "Product" ADD COLUMN "syncedAt" TIMESTAMP(3);
ALTER TABLE "Customer" ADD COLUMN "syncedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "syncedAt" TIMESTAMP(3);

CREATE TABLE "WooSyncState" (
  "entity" TEXT NOT NULL,
  "cursor" TEXT,
  "lastRunAt" TIMESTAMP(3),
  "lastResult" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WooSyncState_pkey" PRIMARY KEY ("entity")
);
