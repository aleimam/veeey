-- Loyalty tier auto-promotion (V5 F29): lifetime-spend threshold per tier.
-- Customers are auto-assigned the highest tier whose threshold their lifetime
-- spend meets. Idempotent.
ALTER TABLE "Tier" ADD COLUMN IF NOT EXISTS "minSpendPiastres" BIGINT NOT NULL DEFAULT 0;

-- Seeded starter thresholds (⚠️ business numbers — admin-editable in /admin/tiers;
-- adjust there, not here): VEEEYIP = EGP 20,000 · SELECT = EGP 50,000. Only set
-- when still at the default so an admin's later edit is never overwritten.
UPDATE "Tier" SET "minSpendPiastres" = 2000000 WHERE "key" = 'VEEEYIP' AND "minSpendPiastres" = 0;
UPDATE "Tier" SET "minSpendPiastres" = 5000000 WHERE "key" = 'SELECT'  AND "minSpendPiastres" = 0;
