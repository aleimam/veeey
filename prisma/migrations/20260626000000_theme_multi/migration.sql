-- Multiple storefront themes + per-tier theme assignment (Appearance).

CREATE TABLE "Theme" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "tokens" JSONB NOT NULL DEFAULT '{}',
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Tier" ADD COLUMN "themeId" TEXT;
CREATE INDEX "Tier_themeId_idx" ON "Tier"("themeId");
ALTER TABLE "Tier" ADD CONSTRAINT "Tier_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;
