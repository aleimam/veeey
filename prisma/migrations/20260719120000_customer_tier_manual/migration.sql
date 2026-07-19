-- Manual tier assignment / paid membership (owner 2026-07-19): a locked tier the
-- auto-recompute + hourly customer sync must NOT overwrite. `tierManualUntil`
-- bounds a PAID membership (e.g. SELECT for one year); null = indefinite manual.
-- Additive + idempotent.

ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tierManual" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "tierManualUntil" TIMESTAMP(3);
