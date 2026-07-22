-- Delivery districts for the checkout "City" dropdown (owner 2026-07-23).
-- Idempotent: this store's schema is applied by hand on two boxes, so a re-run
-- must be a no-op rather than an error (migration discipline).

CREATE TABLE IF NOT EXISTS "City" (
  "id"          TEXT NOT NULL,
  "code"        TEXT NOT NULL,
  "governorate" TEXT NOT NULL,
  "nameEn"      TEXT NOT NULL,
  "nameAr"      TEXT NOT NULL,
  "active"      BOOLEAN NOT NULL DEFAULT true,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"   TIMESTAMP(3) NOT NULL,
  CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "City_code_key" ON "City" ("code");
CREATE INDEX IF NOT EXISTS "City_governorate_active_idx" ON "City" ("governorate", "active");
