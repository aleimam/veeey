-- V5 Customers (F30/F31/F35): phone verification, account standing, SMS
-- marketing consent, admin notes. Idempotent (IF NOT EXISTS / duplicate guards).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "phoneVerified" TIMESTAMP(3);

DO $$ BEGIN
  CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'FLAGGED', 'BLOCKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "adminNotes" TEXT;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "marketingSmsConsent" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Customer_status_idx" ON "Customer"("status");
