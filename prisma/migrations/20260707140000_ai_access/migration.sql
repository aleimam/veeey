-- AI access: turn IntegrationClient into scoped API keys + add the staged-write
-- approval queue (AiProposal). Idempotent (safe to re-run / already-partly-applied).

ALTER TABLE "IntegrationClient" ADD COLUMN IF NOT EXISTS "keyPrefix" TEXT;
ALTER TABLE "IntegrationClient" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);
ALTER TABLE "IntegrationClient" ADD COLUMN IF NOT EXISTS "createdById" TEXT;

DO $$ BEGIN
  CREATE TYPE "AiProposalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'APPLIED', 'FAILED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS "AiProposal" (
  "id" TEXT NOT NULL,
  "clientId" TEXT,
  "clientName" TEXT,
  "action" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT,
  "payloadJson" JSONB NOT NULL,
  "status" "AiProposalStatus" NOT NULL DEFAULT 'PENDING',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "resultJson" JSONB,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AiProposal_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "AiProposal_status_idx" ON "AiProposal"("status");
