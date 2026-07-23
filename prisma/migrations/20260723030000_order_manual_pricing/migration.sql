-- Order-level manual pricing: a staff-added titled discount (value or %) that
-- stacks on top of the coupon discount, plus a flag marking the shipping fee as
-- hand-overridden. Idempotent (IF NOT EXISTS) so a re-run on a partially-migrated
-- box is safe.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "manualDiscountTitle" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "manualDiscountPct" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "manualDiscountPiastres" BIGINT NOT NULL DEFAULT 0;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "shippingFeeManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "paidAmountPiastres" BIGINT;
