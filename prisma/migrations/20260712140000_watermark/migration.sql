-- Reversible product-photo watermarking: keep the original when stamped.
ALTER TABLE "ProductImage" ADD COLUMN IF NOT EXISTS "originalUrl" TEXT;
