-- Special-order requests can exist as standalone leads (no Order yet) + carry
-- requester details.
ALTER TABLE "SpecialOrder" ALTER COLUMN "orderId" DROP NOT NULL;
ALTER TABLE "SpecialOrder" ADD COLUMN "customerId" TEXT;
ALTER TABLE "SpecialOrder" ADD COLUMN "productUrl" TEXT;
ALTER TABLE "SpecialOrder" ADD COLUMN "requesterName" TEXT;
ALTER TABLE "SpecialOrder" ADD COLUMN "requesterPhone" TEXT;
ALTER TABLE "SpecialOrder" ADD COLUMN "requesterEmail" TEXT;
ALTER TABLE "SpecialOrder" ADD COLUMN "notes" TEXT;

ALTER TABLE "SpecialOrder" ADD CONSTRAINT "SpecialOrder_customerId_fkey"
  FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "SpecialOrder_customerId_idx" ON "SpecialOrder"("customerId");
CREATE INDEX "SpecialOrder_status_idx" ON "SpecialOrder"("status");
