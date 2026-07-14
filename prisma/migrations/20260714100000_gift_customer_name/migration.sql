-- Gift customer-facing bilingual name (audit LOW): the order confirmation showed
-- the admin-only internalName verbatim. Optional EN/AR names, fall back to
-- internalName when unset. Additive + idempotent.

ALTER TABLE "Gift" ADD COLUMN IF NOT EXISTS "nameEn" TEXT;
ALTER TABLE "Gift" ADD COLUMN IF NOT EXISTS "nameAr" TEXT;
