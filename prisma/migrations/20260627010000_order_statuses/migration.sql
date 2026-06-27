-- STAT: editable order statuses (OrderStatusConfig) + customer/legacy status + LOST items.

-- 1) Order.status: enum -> TEXT, preserve the raw value, remap 11 codes -> 8.
ALTER TABLE "Order" ADD COLUMN "customerStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "legacyStatus" TEXT;
UPDATE "Order" SET "legacyStatus" = "status"::text;

ALTER TABLE "Order" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Order" ALTER COLUMN "status" TYPE TEXT USING ("status"::text);
UPDATE "Order" SET "status" = CASE "status"
  WHEN 'DRAFT' THEN 'PENDING'
  WHEN 'PENDING_CONFIRMATION' THEN 'PENDING'
  WHEN 'PROCESSING' THEN 'CONFIRMED'
  WHEN 'CASH_DELIVERED' THEN 'DELIVERED'
  WHEN 'CARD_DELIVERED' THEN 'DELIVERED'
  WHEN 'FAILED' THEN 'CANCELLED'
  ELSE "status"
END;
ALTER TABLE "Order" ALTER COLUMN "status" SET DEFAULT 'PENDING';
-- Customer-facing mirror (EDIT has no customer mapping → show Confirmed for legacy EDIT rows).
UPDATE "Order" SET "customerStatus" = CASE WHEN "status" = 'EDIT' THEN 'CONFIRMED' ELSE "status" END;

DROP TYPE "OrderStatus";

-- 2) OrderItem LOST flag.
ALTER TABLE "OrderItem" ADD COLUMN "lost" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrderItem" ADD COLUMN "lostAt" TIMESTAMP(3);
ALTER TABLE "OrderItem" ADD COLUMN "lostReason" TEXT;

-- 3) OrderStatusConfig table + seed of the 8 default statuses.
CREATE TABLE "OrderStatusConfig" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "labelEn" TEXT NOT NULL,
  "labelAr" TEXT,
  "customerCode" TEXT,
  "icon" TEXT NOT NULL DEFAULT 'circle',
  "stockEffect" TEXT NOT NULL DEFAULT 'none',
  "paymentEffect" TEXT NOT NULL DEFAULT 'none',
  "revenueEffect" TEXT NOT NULL DEFAULT 'none',
  "loyaltyEffect" TEXT NOT NULL DEFAULT 'none',
  "notifyAudience" TEXT NOT NULL DEFAULT 'none',
  "notifyTemplateKey" TEXT,
  "allowedNext" TEXT[],
  "sourceAliases" TEXT[],
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "OrderStatusConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "OrderStatusConfig_code_key" ON "OrderStatusConfig"("code");

INSERT INTO "OrderStatusConfig"
  ("id","code","labelEn","labelAr","customerCode","icon","stockEffect","paymentEffect","revenueEffect","loyaltyEffect","notifyAudience","notifyTemplateKey","allowedNext","sourceAliases","sortOrder","active","isDefault","updatedAt")
VALUES
  ('osc_pending','PENDING','Pending','قيد الانتظار','PENDING','clock','none','none','none','none','none',NULL,
    ARRAY['CONFIRMED','HOLD','EDIT','CANCELLED'],
    ARRAY['pending','draft','pending confirmation','pending-confirmation','pending_confirmation','checkout-draft','wc-pending','wc-checkout-draft'],1,true,true,CURRENT_TIMESTAMP),
  ('osc_edit','EDIT','Edit','تعديل',NULL,'pencil','none','none','none','none','none',NULL,
    ARRAY['PENDING','HOLD','CONFIRMED','CANCELLED'],
    ARRAY['edit'],2,true,false,CURRENT_TIMESTAMP),
  ('osc_hold','HOLD','Hold','معلّق','HOLD','pause-circle','none','none','none','none','none',NULL,
    ARRAY['CONFIRMED','EDIT','CANCELLED'],
    ARRAY['hold','on-hold','on hold','wc-on-hold'],3,true,false,CURRENT_TIMESTAMP),
  ('osc_confirmed','CONFIRMED','Confirmed','مؤكد','CONFIRMED','badge-check','none','none','none','none','customer','order.confirmed',
    ARRAY['SHIPPED','HOLD','EDIT','CANCELLED'],
    ARRAY['processing','confirmed','wc-processing'],4,true,false,CURRENT_TIMESTAMP),
  ('osc_shipped','SHIPPED','Shipped','تم الشحن','SHIPPED','truck','none','none','none','none','customer','order.shipped',
    ARRAY['DELIVERED','CANCELLED','REFUNDED'],
    ARRAY['shipped','wc-shipped'],5,true,false,CURRENT_TIMESTAMP),
  ('osc_delivered','DELIVERED','Delivered','تم التسليم','DELIVERED','package-check','none','paid','realize','credit','customer','order.delivered',
    ARRAY['REFUNDED'],
    ARRAY['delivered','completed','cash delivered','card delivered','cash-delivered','card-delivered','cash_delivered','card_delivered','wc-completed'],6,true,false,CURRENT_TIMESTAMP),
  ('osc_cancelled','CANCELLED','Cancelled','ملغى','CANCELLED','x-circle','restock','none','reverse','reverse','customer','order.cancelled',
    ARRAY[]::TEXT[],
    ARRAY['cancelled','canceled','failed','wc-cancelled','wc-failed'],7,true,false,CURRENT_TIMESTAMP),
  ('osc_refunded','REFUNDED','Refunded','مُسترد','REFUNDED','rotate-ccw','restock','refunded','reverse','reverse','customer','order.refunded',
    ARRAY[]::TEXT[],
    ARRAY['refunded','wc-refunded','partially-refunded'],8,true,false,CURRENT_TIMESTAMP);
