-- #185 Abandoned-cart recovery: one cart summary per signed-in customer.
-- Additive, idempotent.

CREATE TABLE IF NOT EXISTS "CartSnapshot" (
  "id"               TEXT NOT NULL,
  "customerId"       TEXT NOT NULL,
  "cartId"           TEXT NOT NULL,
  "itemCount"        INTEGER NOT NULL,
  "subtotalPiastres" BIGINT NOT NULL DEFAULT 0,
  "reminderSentAt"   TIMESTAMP(3),
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CartSnapshot_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "CartSnapshot"
    ADD CONSTRAINT "CartSnapshot_customerId_fkey"
    FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "CartSnapshot_customerId_key" ON "CartSnapshot"("customerId");
CREATE INDEX IF NOT EXISTS "CartSnapshot_reminderSentAt_idx" ON "CartSnapshot"("reminderSentAt");
