-- net-sync Phase 3: exactly-once ledger for veeey.net → egyptvitamins.net stock
-- deltas. Additive + idempotent (safe on both stores; stays empty on veeey.com).

-- CreateTable
CREATE TABLE IF NOT EXISTS "NetStockOutbox" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "orderNumber" TEXT,
    "wpId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "stockAfter" INTEGER,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NetStockOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "NetStockOutbox_orderId_wpId_direction_key" ON "NetStockOutbox"("orderId", "wpId", "direction");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "NetStockOutbox_status_idx" ON "NetStockOutbox"("status");
