-- Customer product Q&A ("Answered Questions").
CREATE TABLE IF NOT EXISTS "ProductQuestion" (
  "id"         TEXT NOT NULL,
  "productId"  TEXT NOT NULL,
  "customerId" TEXT,
  "askerName"  TEXT,
  "question"   TEXT NOT NULL,
  "answer"     TEXT,
  "status"     TEXT NOT NULL DEFAULT 'PENDING',
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "answeredAt" TIMESTAMP(3),
  CONSTRAINT "ProductQuestion_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "ProductQuestion"
    ADD CONSTRAINT "ProductQuestion_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "ProductQuestion_productId_status_idx" ON "ProductQuestion" ("productId", "status");
CREATE INDEX IF NOT EXISTS "ProductQuestion_status_idx" ON "ProductQuestion" ("status");
