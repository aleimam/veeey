-- Product variant families (audit P1 §5.4): sibling Products linked into a
-- VariantGroup with structured axes (size/flavor/…). Additive + idempotent.

CREATE TABLE IF NOT EXISTS "VariantGroup" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "axesJson" JSONB NOT NULL DEFAULT '[]',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "VariantGroup_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "variantGroupId" TEXT;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "variantJson" JSONB;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "variantSort" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Product_variantGroupId_idx" ON "Product"("variantGroupId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Product_variantGroupId_fkey') THEN
    ALTER TABLE "Product" ADD CONSTRAINT "Product_variantGroupId_fkey"
      FOREIGN KEY ("variantGroupId") REFERENCES "VariantGroup"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
