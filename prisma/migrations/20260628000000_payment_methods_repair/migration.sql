-- Repair migration. The 20260627000000_payment_methods migration was recorded as
-- applied while it still held its earlier (single-list) SQL; the file was later
-- rewritten to the two-level model, so the new PAY columns/table were never
-- created on already-migrated databases. This idempotently adds exactly the
-- missing pieces (safe whether or not any part already exists).

-- Order.paymentMethod → TEXT (only if it's still the old PaymentMethod enum).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Order'
      AND column_name = 'paymentMethod' AND data_type = 'USER-DEFINED'
  ) THEN
    ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE TEXT USING ("paymentMethod"::text);
  END IF;
END $$;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "systemPaymentMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "legacyPaymentMethod" TEXT;
ALTER TABLE "ShippingArea" ADD COLUMN IF NOT EXISTS "allowsPos" BOOLEAN NOT NULL DEFAULT false;

-- Re-map legacy customer-facing codes to the two-level set.
UPDATE "Order" SET "paymentMethod" = 'CARD_KASHIER'  WHERE "paymentMethod" = 'KASHIER';
UPDATE "Order" SET "paymentMethod" = 'CARD_OPAY'     WHERE "paymentMethod" = 'OPAY';
UPDATE "Order" SET "paymentMethod" = 'BANK_TRANSFER' WHERE "paymentMethod" = 'WALLET';

-- Editable system payment methods (seeded lazily by the app on first use).
CREATE TABLE IF NOT EXISTS "SystemPaymentMethod" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "labelAr" TEXT,
  "customerCode" TEXT NOT NULL,
  "courier" TEXT,
  "sourceAliases" TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemPaymentMethod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SystemPaymentMethod_code_key" ON "SystemPaymentMethod"("code");
