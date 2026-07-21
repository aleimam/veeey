-- Incoming Shipments (YeldnIN stock-in), Stage 1.
--
-- A shipment ARRIVING from the supply chain lands as a REVIEW RECORD only — no
-- stock moves until Sales compare the entered expiry dates against the photos
-- and approve. Purely additive: nothing here touches Lot or any existing table.

CREATE TABLE IF NOT EXISTS "IncomingShipment" (
    "id"           TEXT NOT NULL,
    "yeldninUid"   TEXT NOT NULL,
    "yeldninId"    INTEGER NOT NULL,
    "receivedAt"   TIMESTAMP(3) NOT NULL,
    "status"       TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
    "locationId"   TEXT,
    "reviewedById" TEXT,
    "reviewedAt"   TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IncomingShipment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IncomingShipmentLot" (
    "id"          TEXT NOT NULL,
    "shipmentId"  TEXT NOT NULL,
    "productId"   TEXT,
    "sku"         TEXT,
    "productName" TEXT NOT NULL,
    "expiryDate"  TIMESTAMP(3),
    "lotCode"     TEXT,
    "quantity"    INTEGER NOT NULL,
    "unitCost"    DOUBLE PRECISION,
    "currency"    TEXT,
    CONSTRAINT "IncomingShipmentLot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IncomingShipmentPhoto" (
    "id"         TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "assetId"    TEXT NOT NULL,
    CONSTRAINT "IncomingShipmentPhoto_pkey" PRIMARY KEY ("id")
);

-- The uid is the idempotency key: a re-fired shipment.received must update the
-- existing row, never create a second one.
CREATE UNIQUE INDEX IF NOT EXISTS "IncomingShipment_yeldninUid_key" ON "IncomingShipment"("yeldninUid");
CREATE INDEX IF NOT EXISTS "IncomingShipment_status_idx" ON "IncomingShipment"("status");
CREATE INDEX IF NOT EXISTS "IncomingShipment_receivedAt_idx" ON "IncomingShipment"("receivedAt");
CREATE INDEX IF NOT EXISTS "IncomingShipmentLot_shipmentId_idx" ON "IncomingShipmentLot"("shipmentId");
CREATE INDEX IF NOT EXISTS "IncomingShipmentLot_productId_idx" ON "IncomingShipmentLot"("productId");
CREATE INDEX IF NOT EXISTS "IncomingShipmentPhoto_shipmentId_idx" ON "IncomingShipmentPhoto"("shipmentId");

DO $$ BEGIN
  ALTER TABLE "IncomingShipment" ADD CONSTRAINT "IncomingShipment_locationId_fkey"
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "IncomingShipmentLot" ADD CONSTRAINT "IncomingShipmentLot_shipmentId_fkey"
    FOREIGN KEY ("shipmentId") REFERENCES "IncomingShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "IncomingShipmentLot" ADD CONSTRAINT "IncomingShipmentLot_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "IncomingShipmentPhoto" ADD CONSTRAINT "IncomingShipmentPhoto_shipmentId_fkey"
    FOREIGN KEY ("shipmentId") REFERENCES "IncomingShipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
