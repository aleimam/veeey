-- Per-user admin section visit counters (dashboard quick-access cards).
-- Idempotent (IF NOT EXISTS / duplicate guards).

CREATE TABLE IF NOT EXISTS "AdminSectionUsage" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "section" TEXT NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminSectionUsage_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AdminSectionUsage_userId_section_key" ON "AdminSectionUsage"("userId", "section");

DO $$ BEGIN
  ALTER TABLE "AdminSectionUsage"
    ADD CONSTRAINT "AdminSectionUsage_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
