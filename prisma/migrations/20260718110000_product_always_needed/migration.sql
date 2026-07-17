-- Always-Needed (Requests epic C): a product sales/admin mark as continuously
-- needed with a target X. A monthly job keeps an open OPTIONAL purchasing
-- request of X units for it. Idempotent (safe to re-run / already-applied).
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "alwaysNeeded" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "alwaysNeededQty" INTEGER;
