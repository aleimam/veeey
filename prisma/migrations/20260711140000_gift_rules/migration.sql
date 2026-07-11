-- Gift-with-purchase automation: admin-configurable rules that auto-attach a
-- gift when an order qualifies (subtotal threshold / contains product / contains
-- category — AND-ed where present). Idempotent.
CREATE TABLE IF NOT EXISTS "GiftRule" (
  "id" TEXT NOT NULL,
  "nameEn" TEXT NOT NULL,
  "nameAr" TEXT,
  "giftId" TEXT NOT NULL,
  "giftQty" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "minSubtotalPiastres" BIGINT,
  "productId" TEXT,
  "categoryId" TEXT,
  "startsAt" TIMESTAMP(3),
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftRule_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GiftRule_active_idx" ON "GiftRule"("active");

DO $$ BEGIN
  ALTER TABLE "GiftRule" ADD CONSTRAINT "GiftRule_giftId_fkey"
    FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "GiftRule" ADD CONSTRAINT "GiftRule_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "GiftRule" ADD CONSTRAINT "GiftRule_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
