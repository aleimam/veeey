-- Structured, managed return reasons (V1 Admin Panel §4). Replaces free-text
-- return reasons with a bilingual, admin-managed list + an "Other" free-text
-- fallback and a required sub-detail for reasons that need one.

CREATE TABLE IF NOT EXISTS "ReturnReason" (
    "id" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelAr" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "requiresDetail" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ReturnReason_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ReturnReason_active_sortOrder_idx" ON "ReturnReason" ("active", "sortOrder");

-- Return: link to the managed reason + a free-text note (Other / sub-detail).
-- reasonCode is kept as a denormalized readable snapshot of the reason label.
ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "reasonId" TEXT;
ALTER TABLE "Return" ADD COLUMN IF NOT EXISTS "reasonNote" TEXT;

CREATE INDEX IF NOT EXISTS "Return_reasonId_idx" ON "Return" ("reasonId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Return_reasonId_fkey') THEN
    ALTER TABLE "Return" ADD CONSTRAINT "Return_reasonId_fkey"
      FOREIGN KEY ("reasonId") REFERENCES "ReturnReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed the initial reason list (idempotent). requiresDetail flags reasons that
-- reveal a free-text sub-detail: "Product issue" and "Other".
INSERT INTO "ReturnReason" ("id", "labelEn", "labelAr", "active", "sortOrder", "requiresDetail", "createdAt", "updatedAt") VALUES
  ('rr_warm',          'Order arrived warm / not temperature-controlled', 'وصل الطلب ساخنًا / لم يُحفظ مبرّدًا', true, 1,  false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_no_inspect',    'Courier did not allow inspection before accepting', 'مندوب الشحن لم يسمح بفتح الطلب قبل الاستلام', true, 2,  false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_cheaper',       'Found at a lower price elsewhere', 'وجدت المنتج بسعر أقل في مكان آخر', true, 3,  false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_product_issue', 'Product issue', 'مشكلة في المنتج', true, 4,  true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_wrong_item',    'Wrong item received', 'استلمت منتجًا خاطئًا', true, 5,  false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_damaged',       'Item damaged in transit', 'المنتج تالف أثناء الشحن', true, 6,  false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_opened',        'Package opened / seal broken', 'العبوة مفتوحة / الختم مكسور', true, 7,  false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_expired',       'Product expired or near expiry date', 'المنتج منتهي الصلاحية أو قريب من انتهائها', true, 8,  false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_missing',       'Missing item(s) from the order', 'أصناف ناقصة من الطلب', true, 9,  false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_late',          'Late delivery / no longer needed', 'تأخّر التوصيل / لم أعد بحاجة للمنتج', true, 10, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_changed_mind',  'Changed my mind', 'غيّرت رأيي', true, 11, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_mistake',       'Ordered by mistake / duplicate order', 'طلب بالخطأ / طلب مكرر', true, 12, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_counterfeit',   'Suspected counterfeit / authenticity concern', 'شكّ في أصالة المنتج', true, 13, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_adverse',       'Adverse reaction / doctor''s advice', 'رد فعل تحسسي / بناءً على نصيحة الطبيب', true, 14, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('rr_other',         'Other', 'أخرى', true, 15, true,  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
