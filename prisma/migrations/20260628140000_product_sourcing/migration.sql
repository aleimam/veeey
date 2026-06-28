-- Product sourcing (internal) + male-support flag.
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "maleSupport" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "purchaseUrl" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "originCountry" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "purchaseCostMinor" INTEGER;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "purchaseCurrency" TEXT;
