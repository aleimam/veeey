-- Payment methods: two-level model.
--   Order.paymentMethod        = customer-facing method code (checkout)
--   Order.systemPaymentMethod  = granular SystemPaymentMethod.code (invoice/packing)
--   Order.legacyPaymentMethod  = raw WooCommerce payment_method (re-mapping)
-- The old PaymentMethod enum is dropped; existing order values are re-mapped to the
-- new fixed customer-facing codes. Additive + safe (values preserved as text).

ALTER TABLE "Order" ALTER COLUMN "paymentMethod" TYPE TEXT USING "paymentMethod"::text;
ALTER TABLE "Order" ADD COLUMN "systemPaymentMethod" TEXT;
ALTER TABLE "Order" ADD COLUMN "legacyPaymentMethod" TEXT;

DROP TYPE "PaymentMethod";

-- Existing customer-facing values → new fixed set
UPDATE "Order" SET "paymentMethod" = 'CARD_KASHIER' WHERE "paymentMethod" = 'KASHIER';
UPDATE "Order" SET "paymentMethod" = 'CARD_OPAY'    WHERE "paymentMethod" = 'OPAY';
UPDATE "Order" SET "paymentMethod" = 'BANK_TRANSFER' WHERE "paymentMethod" = 'WALLET';

-- POS-on-Delivery eligibility per shipping area (admin toggles; all OFF by default)
ALTER TABLE "ShippingArea" ADD COLUMN "allowsPos" BOOLEAN NOT NULL DEFAULT false;

-- Editable granular internal payment methods
CREATE TABLE "SystemPaymentMethod" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "labelAr" TEXT,
  "customerCode" TEXT NOT NULL,
  "courier" TEXT,
  "sourceAliases" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "active" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SystemPaymentMethod_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SystemPaymentMethod_code_key" ON "SystemPaymentMethod"("code");

INSERT INTO "SystemPaymentMethod" ("id","code","labelEn","labelAr","customerCode","courier","sourceAliases","active","sortOrder","updatedAt") VALUES
 ('spm_cod_own','COD_OWN','Cash on Delivery (Our Staff)','الدفع عند الاستلام (مندوبنا)','COD','OWN',ARRAY['cod','cash','cod_own'],true,1,CURRENT_TIMESTAMP),
 ('spm_cod_smsa','COD_SMSA','Cash on Delivery (SMSA)','الدفع عند الاستلام (سمسا)','COD','SMSA',ARRAY['cod_smsa'],true,2,CURRENT_TIMESTAMP),
 ('spm_cod_aramex','COD_ARAMEX','Cash on Delivery (Aramex)','الدفع عند الاستلام (أرامكس)','COD','ARAMEX',ARRAY['cod_aramex'],true,3,CURRENT_TIMESTAMP),
 ('spm_opay','OPAY','OPay','OPay','CARD_OPAY',NULL,ARRAY['opay'],true,4,CURRENT_TIMESTAMP),
 ('spm_kashier','KASHIER','Kashier','Kashier','CARD_KASHIER',NULL,ARRAY['kashier','kashier_card'],true,5,CURRENT_TIMESTAMP),
 ('spm_pos_gediea','POS_GEDIEA','Gediea POS','جديعة POS','POS_ON_DELIVERY',NULL,ARRAY['gediea','gediea_pos'],true,6,CURRENT_TIMESTAMP),
 ('spm_pos_aman','POS_AMAN','Aman POS','أمان POS','POS_ON_DELIVERY',NULL,ARRAY['aman','aman_pos'],true,7,CURRENT_TIMESTAMP),
 ('spm_pos_kashier','POS_KASHIER','Kashier POS','Kashier POS','POS_ON_DELIVERY',NULL,ARRAY['kashier_pos'],true,8,CURRENT_TIMESTAMP),
 ('spm_bank_alex','BANK_ALEX','Bank Transfer / InstaPay (Alex Bank)','تحويل بنكي / إنستاباي (بنك الإسكندرية)','BANK_TRANSFER',NULL,ARRAY['alexbank','bank_alex','instapay_alex'],true,9,CURRENT_TIMESTAMP),
 ('spm_bank_other','BANK_OTHER','Bank Transfer / InstaPay (Other Banks)','تحويل بنكي / إنستاباي (بنوك أخرى)','BANK_TRANSFER',NULL,ARRAY['bacs','bank','bank_transfer','instapay'],true,10,CURRENT_TIMESTAMP),
 ('spm_wallet','WALLET','Mobile Wallet','محفظة إلكترونية','BANK_TRANSFER',NULL,ARRAY['wallet','vodafone_cash','fawry','mobile_wallet'],true,11,CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
