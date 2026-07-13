-- Veeey Refill autoship (epic #119): plans + run log. Additive + idempotent.

CREATE TABLE IF NOT EXISTS "RefillPlan" (
  "id" TEXT NOT NULL,
  "customerId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 1,
  "frequencyDays" INTEGER NOT NULL DEFAULT 30,
  "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "noticedRunAt" TIMESTAMP(3),
  "skipNext" BOOLEAN NOT NULL DEFAULT false,
  "manageToken" TEXT NOT NULL,
  "addressJson" JSONB NOT NULL,
  "addressId" TEXT,
  "lastOrderId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RefillPlan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "RefillPlan_manageToken_key" ON "RefillPlan"("manageToken");
CREATE INDEX IF NOT EXISTS "RefillPlan_customerId_idx" ON "RefillPlan"("customerId");
CREATE INDEX IF NOT EXISTS "RefillPlan_status_nextRunAt_idx" ON "RefillPlan"("status", "nextRunAt");

CREATE TABLE IF NOT EXISTS "RefillRun" (
  "id" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "outcome" TEXT NOT NULL,
  "orderId" TEXT,
  "note" TEXT,
  CONSTRAINT "RefillRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "RefillRun_planId_idx" ON "RefillRun"("planId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RefillPlan_customerId_fkey') THEN
    ALTER TABLE "RefillPlan" ADD CONSTRAINT "RefillPlan_customerId_fkey"
      FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RefillPlan_productId_fkey') THEN
    ALTER TABLE "RefillPlan" ADD CONSTRAINT "RefillPlan_productId_fkey"
      FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'RefillRun_planId_fkey') THEN
    ALTER TABLE "RefillRun" ADD CONSTRAINT "RefillRun_planId_fkey"
      FOREIGN KEY ("planId") REFERENCES "RefillPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
