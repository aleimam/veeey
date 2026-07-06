-- Verified-purchase badge (audit P1 5.1): set on native reviews when the
-- reviewer bought the product, and mapped from WooCommerce "verified" on import.
ALTER TABLE "Review" ADD COLUMN IF NOT EXISTS "verifiedPurchase" BOOLEAN NOT NULL DEFAULT false;
