-- Lot condition variants (owner batch #8): NEW (default) / OPEN_BOX / DAMAGED / BROKEN.
ALTER TABLE "Lot" ADD COLUMN IF NOT EXISTS "condition" TEXT NOT NULL DEFAULT 'NEW';
-- Snapshot of the bound lot's condition on the order line (travels to invoice).
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "condition" TEXT;
