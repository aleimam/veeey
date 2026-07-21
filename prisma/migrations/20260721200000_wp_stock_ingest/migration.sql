-- Stage 2 (the inversion): ingest stock movements that ORIGINATE on
-- egyptvitamins.net, so veeey.net can become the stock master while ev.net keeps
-- selling the same physical pool.
--
-- These must never be written back to WP: Woo already decremented its own stock
-- when the sale happened, so echoing them would subtract the same unit twice.
-- Rows start at SHADOW — recorded and reconciled against WP's real stock during
-- the shadow-run week, applying nothing until that diff proves near-zero.
--
-- Purely additive.

CREATE TABLE IF NOT EXISTS "WpStockIngest" (
    "id"          TEXT NOT NULL,
    "wpOrderId"   INTEGER NOT NULL,
    "orderNumber" TEXT,
    "wpId"        INTEGER NOT NULL,
    "productId"   TEXT,
    "qty"         INTEGER NOT NULL,
    "direction"   TEXT NOT NULL,
    "status"      TEXT NOT NULL DEFAULT 'SHADOW',
    "appliedAt"   TIMESTAMP(3),
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WpStockIngest_pkey" PRIMARY KEY ("id")
);

-- Exactly-once per (ev.net order, product, direction): a webhook and the polling
-- safety net will both see the same sale, and neither may double-count it.
CREATE UNIQUE INDEX IF NOT EXISTS "WpStockIngest_wpOrderId_wpId_direction_key"
  ON "WpStockIngest"("wpOrderId", "wpId", "direction");
CREATE INDEX IF NOT EXISTS "WpStockIngest_status_idx" ON "WpStockIngest"("status");
CREATE INDEX IF NOT EXISTS "WpStockIngest_createdAt_idx" ON "WpStockIngest"("createdAt");
