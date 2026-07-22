-- Stage 3: approving an incoming shipment creates real, sellable stock.
--
-- `lotId` is both the audit trail and the idempotency guard — non-null means
-- this line has already been stocked, so a re-fired approval or a double-click
-- cannot add the same units twice.
--
-- The cost fields PIN the conversion at approval. A cost is a historical fact:
-- if we stored only the supplier's foreign figure, every lot would silently
-- re-value itself whenever the exchange rate moved.
ALTER TABLE "IncomingShipmentLot" ADD COLUMN IF NOT EXISTS "lotId" TEXT;
ALTER TABLE "IncomingShipmentLot" ADD COLUMN IF NOT EXISTS "costPiastres" BIGINT;
ALTER TABLE "IncomingShipmentLot" ADD COLUMN IF NOT EXISTS "fxRate" DOUBLE PRECISION;
ALTER TABLE "IncomingShipmentLot" ADD COLUMN IF NOT EXISTS "fxRateDate" TEXT;
ALTER TABLE "IncomingShipmentLot" ADD COLUMN IF NOT EXISTS "fxStale" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'IncomingShipmentLot_lotId_fkey'
  ) THEN
    ALTER TABLE "IncomingShipmentLot"
      ADD CONSTRAINT "IncomingShipmentLot_lotId_fkey"
      FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
