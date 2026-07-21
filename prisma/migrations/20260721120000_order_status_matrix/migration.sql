-- Status Matrix (STAT): per-status RBAC + fast-action flags on OrderStatusConfig.
-- `advancePermission` = the RBAC key required to move an order INTO this status
-- (null → the baseline orders.write). `fastAction` = offer the transition as a
-- one-click icon in the admin orders list. Additive + idempotent.

ALTER TABLE "OrderStatusConfig" ADD COLUMN IF NOT EXISTS "advancePermission" TEXT;
ALTER TABLE "OrderStatusConfig" ADD COLUMN IF NOT EXISTS "fastAction" BOOLEAN NOT NULL DEFAULT false;

-- Seed sensible defaults onto the already-deployed rows (owner-editable after).
-- Guarded on advancePermission IS NULL so a re-run or a later admin edit is
-- never clobbered. Owner rule: only Sales (orders.write) may Confirm; Operations
-- (orders.fulfill) may Ship/Deliver but not Confirm.
UPDATE "OrderStatusConfig" SET "advancePermission" = 'orders.write',   "fastAction" = true
  WHERE "code" = 'CONFIRMED' AND "advancePermission" IS NULL;
UPDATE "OrderStatusConfig" SET "advancePermission" = 'orders.fulfill', "fastAction" = true
  WHERE "code" = 'SHIPPED'   AND "advancePermission" IS NULL;
UPDATE "OrderStatusConfig" SET "advancePermission" = 'orders.fulfill', "fastAction" = true
  WHERE "code" = 'DELIVERED' AND "advancePermission" IS NULL;
UPDATE "OrderStatusConfig" SET "advancePermission" = 'orders.write'
  WHERE "code" = 'CANCELLED' AND "advancePermission" IS NULL;
UPDATE "OrderStatusConfig" SET "advancePermission" = 'finance.manage'
  WHERE "code" = 'REFUNDED'  AND "advancePermission" IS NULL;
UPDATE "OrderStatusConfig" SET "advancePermission" = 'returns.manage'
  WHERE "code" = 'RETURNED'  AND "advancePermission" IS NULL;
