-- Pre-order purchase path (owner batch follow-up): a pre-order line has no bound
-- lot (awaiting stock); the order takes a deposit with the balance due on
-- delivery. Order.isPreorder flags such orders for fulfilment; OrderItem.preorder
-- marks the individual awaiting-stock line (no lot, no stock decrement, no
-- revenue until fulfilled).
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "isPreorder" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN IF NOT EXISTS "preorder" BOOLEAN NOT NULL DEFAULT false;
