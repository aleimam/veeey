-- Gift stock movement audit (gifts stay a counter — NOT lot-tracked).
CREATE TABLE IF NOT EXISTS "GiftMovement" (
  "id"        TEXT NOT NULL,
  "giftId"    TEXT NOT NULL,
  "type"      TEXT NOT NULL,
  "qtyDelta"  INTEGER NOT NULL,
  "refType"   TEXT,
  "refId"     TEXT,
  "note"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GiftMovement_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "GiftMovement"
    ADD CONSTRAINT "GiftMovement_giftId_fkey"
    FOREIGN KEY ("giftId") REFERENCES "Gift"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "GiftMovement_giftId_createdAt_idx" ON "GiftMovement" ("giftId", "createdAt");
CREATE INDEX IF NOT EXISTS "GiftMovement_refType_refId_idx" ON "GiftMovement" ("refType", "refId");
