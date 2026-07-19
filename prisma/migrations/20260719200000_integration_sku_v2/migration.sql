-- Contract v2 (products/customers slice) §7: the canonical shared SKU for the
-- YeldnIN v2 channel. Numeric (legacyWpId when present, else minted from the
-- sequence), `base-N` for variations, IMMUTABLE once assigned. The storefront
-- `Product.sku` (VEY-…) is untouched — orders/requests keep matching on it.
-- Additive + idempotent.

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "integrationSku" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Product_integrationSku_key" ON "Product"("integrationSku");

-- Mint source for products with no WordPress id. Starts far above the WP post-id
-- range (~120k, growing ~5/week) so minted ids can never collide with future
-- legacyWpIds.
CREATE SEQUENCE IF NOT EXISTS "integration_sku_seq" START WITH 900000;
