-- Phase B: product-model v2 (kind, status, dosage range) + brand banner.

-- Brand banner image
ALTER TABLE "Brand" ADD COLUMN "bannerUrl" TEXT;

-- Product kind: rename OTHER -> INJECTION (existing rows preserved)
ALTER TYPE "ProductKind" RENAME VALUE 'OTHER' TO 'INJECTION';

-- Product status: add PRIVATE (staff-only)
ALTER TYPE "ProductStatus" ADD VALUE 'PRIVATE';

-- Product status default -> PUBLISHED
ALTER TABLE "Product" ALTER COLUMN "status" SET DEFAULT 'PUBLISHED';

-- Daily dosage upper bound (range)
ALTER TABLE "Product" ADD COLUMN "dailyDosageMax" INTEGER;
