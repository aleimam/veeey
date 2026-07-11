-- Wishlist price-drop alerts: exactly-once fan-out marker on product-change
-- events. The old sweep re-read a rolling time window (5-min cron × 10-min
-- lookback) and could notify the same customers twice; now events are consumed
-- once and stamped. Idempotent.
ALTER TABLE "ProductChangeEvent" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "ProductChangeEvent_processedAt_idx" ON "ProductChangeEvent"("processedAt");

-- Mark all pre-existing rows as processed so the first post-deploy sweep does
-- not spam alerts for stale historical events.
UPDATE "ProductChangeEvent" SET "processedAt" = CURRENT_TIMESTAMP WHERE "processedAt" IS NULL;
