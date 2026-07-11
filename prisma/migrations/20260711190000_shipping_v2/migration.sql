-- Shipping module V4 (E25/E26): bilingual zone/sub-area names + structured ETA
-- (min/max business days; etaText stays as an optional display override).
-- Idempotent.
ALTER TABLE "ShippingZone" ADD COLUMN IF NOT EXISTS "nameAr" TEXT;
ALTER TABLE "ShippingArea" ADD COLUMN IF NOT EXISTS "nameAr" TEXT;
ALTER TABLE "ShippingArea" ADD COLUMN IF NOT EXISTS "etaMinDays" INTEGER;
ALTER TABLE "ShippingArea" ADD COLUMN IF NOT EXISTS "etaMaxDays" INTEGER;
