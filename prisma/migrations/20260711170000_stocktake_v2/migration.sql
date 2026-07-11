-- Stocktake rework (V4 D15–D22): reconcile-and-approve flow, blind counts,
-- scoped cycle counts, session attribution + recurring schedules. Idempotent.

ALTER TABLE "StocktakeSession" ADD COLUMN IF NOT EXISTS "blind" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "StocktakeSession" ADD COLUMN IF NOT EXISTS "scopeJson" JSONB;
ALTER TABLE "StocktakeSession" ADD COLUMN IF NOT EXISTS "assignedToId" TEXT;
ALTER TABLE "StocktakeSession" ADD COLUMN IF NOT EXISTS "createdById" TEXT;
ALTER TABLE "StocktakeSession" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "StocktakeSession" ADD COLUMN IF NOT EXISTS "appliedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "StocktakeSchedule" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "locationId" TEXT NOT NULL,
  "scopeJson" JSONB,
  "blind" BOOLEAN NOT NULL DEFAULT false,
  "assignedToId" TEXT,
  "intervalDays" INTEGER NOT NULL,
  "nextAt" TIMESTAMP(3) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StocktakeSchedule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StocktakeSchedule_active_nextAt_idx" ON "StocktakeSchedule"("active", "nextAt");

DO $$ BEGIN
  ALTER TABLE "StocktakeSchedule" ADD CONSTRAINT "StocktakeSchedule_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
