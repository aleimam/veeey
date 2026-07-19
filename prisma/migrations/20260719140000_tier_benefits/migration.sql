-- Tier benefits matrix (owner 2026-07-19). Additive + idempotent.

CREATE TABLE IF NOT EXISTS "TierBenefit" (
    "id" TEXT NOT NULL,
    "key" TEXT,
    "nameEn" TEXT NOT NULL,
    "nameAr" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TierBenefit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TierBenefit_key_key" ON "TierBenefit"("key");

-- Implicit m2m join (Prisma relation "TierBenefits": A = Tier, B = TierBenefit)
CREATE TABLE IF NOT EXISTS "_TierBenefits" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,
    CONSTRAINT "_TierBenefits_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE INDEX IF NOT EXISTS "_TierBenefits_B_index" ON "_TierBenefits"("B");

DO $$ BEGIN
  ALTER TABLE "_TierBenefits" ADD CONSTRAINT "_TierBenefits_A_fkey" FOREIGN KEY ("A") REFERENCES "Tier"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "_TierBenefits" ADD CONSTRAINT "_TierBenefits_B_fkey" FOREIGN KEY ("B") REFERENCES "TierBenefit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
