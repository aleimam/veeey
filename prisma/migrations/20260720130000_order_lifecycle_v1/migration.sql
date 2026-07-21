-- Phase-1 order lifecycle: durable status timeline + restock rule changes.

-- 1. Append-only status timeline (survives the nightly change-log purge).
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderStatusHistory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrderStatusHistory_orderId_idx" ON "OrderStatusHistory"("orderId");
ALTER TABLE "OrderStatusHistory"
  ADD CONSTRAINT "OrderStatusHistory_orderId_fkey"
  FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. Restock rule changes on existing status configs (idempotent).
--    Cancelled restocks only if unshipped; Refunded never restocks.
UPDATE "OrderStatusConfig" SET "stockEffect" = 'restock_if_unshipped' WHERE "code" = 'CANCELLED';
UPDATE "OrderStatusConfig" SET "stockEffect" = 'none'                 WHERE "code" = 'REFUNDED';

-- 3. Wire the RETURNED status into the transition graph (add-once).
UPDATE "OrderStatusConfig" SET "allowedNext" = array_append("allowedNext", 'RETURNED')
  WHERE "code" IN ('CANCELLED','REFUNDED','DELIVERED') AND NOT ('RETURNED' = ANY("allowedNext"));
UPDATE "OrderStatusConfig" SET "allowedNext" = array_append("allowedNext", 'CONFIRMED')
  WHERE "code" = 'SHIPPED' AND NOT ('CONFIRMED' = ANY("allowedNext"));
UPDATE "OrderStatusConfig" SET "allowedNext" = array_append("allowedNext", 'CANCELLED')
  WHERE "code" = 'DELIVERED' AND NOT ('CANCELLED' = ANY("allowedNext"));

-- 4. Seed the RETURNED status row if it doesn't exist.
INSERT INTO "OrderStatusConfig"
  ("id","code","labelEn","labelAr","customerCode","icon","stockEffect","paymentEffect","revenueEffect","loyaltyEffect","notifyAudience","notifyTemplateKey","allowedNext","sourceAliases","sortOrder","active","isDefault","createdAt","updatedAt")
SELECT gen_random_uuid()::text,'RETURNED','Returned','مُرتجع','RETURNED','undo-2','restock','none','reverse','reverse','customer','order.returned',
       ARRAY[]::text[], ARRAY['returned','wc-returned']::text[], 9, true, false, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "OrderStatusConfig" WHERE "code" = 'RETURNED');
