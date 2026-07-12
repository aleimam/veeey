-- Special-order request: size, concentration, and customer reference photos.
ALTER TABLE "SpecialOrder" ADD COLUMN IF NOT EXISTS "size" TEXT;
ALTER TABLE "SpecialOrder" ADD COLUMN IF NOT EXISTS "concentration" TEXT;
ALTER TABLE "SpecialOrder" ADD COLUMN IF NOT EXISTS "photoUrls" TEXT[] NOT NULL DEFAULT '{}';
