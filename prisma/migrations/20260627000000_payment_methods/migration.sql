-- Payment methods: enum → editable config table. Order.paymentMethod becomes the
-- method `code` (text); the old PaymentMethod enum is dropped. Additive + safe:
-- existing order values (COD, KASHIER, …) are preserved as text.

ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE TEXT USING "paymentMethod"::text;
ALTER TABLE "Order" ADD COLUMN "legacyPaymentMethod" TEXT;

DROP TYPE "PaymentMethod";

CREATE TYPE "PaymentMethodKind" AS ENUM ('OFFLINE', 'CARD_GATEWAY');

CREATE TABLE "PaymentMethodConfig" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "labelAr" TEXT,
  "kind" "PaymentMethodKind" NOT NULL DEFAULT 'OFFLINE',
  "gateway" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "instructionsEn" TEXT,
  "instructionsAr" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PaymentMethodConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "PaymentMethodConfig_code_key" ON "PaymentMethodConfig"("code");

-- Seed the current method set (stable text ids; idempotent on code).
INSERT INTO "PaymentMethodConfig" ("id","code","labelEn","labelAr","kind","gateway","active","sortOrder","updatedAt") VALUES
  ('pm_cod','COD','Cash on Delivery','الدفع عند الاستلام','OFFLINE',NULL,true,1,CURRENT_TIMESTAMP),
  ('pm_pos','POS_ON_DELIVERY','Card machine on delivery','ماكينة الدفع عند الاستلام','OFFLINE',NULL,true,2,CURRENT_TIMESTAMP),
  ('pm_kashier','KASHIER','Visa / MasterCard','فيزا / ماستركارد','CARD_GATEWAY','KASHIER',true,3,CURRENT_TIMESTAMP),
  ('pm_bank','BANK_TRANSFER','Bank transfer','تحويل بنكي','OFFLINE',NULL,true,5,CURRENT_TIMESTAMP),
  ('pm_wallet','WALLET','Mobile wallet','محفظة إلكترونية','OFFLINE',NULL,true,6,CURRENT_TIMESTAMP),
  ('pm_opay','OPAY','Visa / MasterCard (OPay)','فيزا / ماستركارد (OPay)','OFFLINE',NULL,false,7,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
