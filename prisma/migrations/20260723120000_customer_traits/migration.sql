-- Customer traits mirrored from orders (owner batch 2026-07-23): Shopping Style +
-- Products type. Reuses the existing CustomerOrderType / OrderProductType enums
-- (already present in the DB via the Order table). Nullable, no backfill.
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "shoppingStyle" "CustomerOrderType";
ALTER TABLE "Customer" ADD COLUMN IF NOT EXISTS "productsType" "OrderProductType";
