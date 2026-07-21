-- Phase-2 spillage / damage management.

CREATE TABLE "SpillageReason" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "labelEn" TEXT NOT NULL,
    "labelAr" TEXT,
    "sellable" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SpillageReason_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SpillageReason_code_key" ON "SpillageReason"("code");
CREATE INDEX "SpillageReason_active_idx" ON "SpillageReason"("active");

CREATE TABLE "SpillageEntry" (
    "id" TEXT NOT NULL,
    "lotId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "reasonCode" TEXT NOT NULL,
    "sellable" BOOLEAN NOT NULL,
    "qty" INTEGER NOT NULL,
    "toLotId" TEXT,
    "unitCostPiastres" BIGINT,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "voidedAt" TIMESTAMP(3),
    "voidedById" TEXT,
    CONSTRAINT "SpillageEntry_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "SpillageEntry_reasonCode_idx" ON "SpillageEntry"("reasonCode");
CREATE INDEX "SpillageEntry_productId_idx" ON "SpillageEntry"("productId");
CREATE INDEX "SpillageEntry_createdAt_idx" ON "SpillageEntry"("createdAt");
ALTER TABLE "SpillageEntry" ADD CONSTRAINT "SpillageEntry_lotId_fkey" FOREIGN KEY ("lotId") REFERENCES "Lot"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SpillageEntry" ADD CONSTRAINT "SpillageEntry_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed the reason list (idempotent).
INSERT INTO "SpillageReason" ("id","code","labelEn","labelAr","sellable","active","isSystem","sortOrder","createdAt","updatedAt") VALUES
  (gen_random_uuid()::text,'LOST','Lost','مفقود',false,true,false,1,now(),now()),
  (gen_random_uuid()::text,'DAMAGED','Damaged (destroyed)','تالف (متلف)',false,true,false,2,now(),now()),
  (gen_random_uuid()::text,'OPEN_BOX','Open box','عبوة مفتوحة',true,true,false,3,now(),now()),
  (gen_random_uuid()::text,'NO_BOX','No box','بدون عبوة',true,true,false,4,now(),now()),
  (gen_random_uuid()::text,'OPEN_BOTTLE','Open bottle','زجاجة مفتوحة',true,true,false,5,now(),now()),
  (gen_random_uuid()::text,'BROKEN_BOTTLE','Broken bottle','زجاجة مكسورة',true,true,false,6,now(),now()),
  (gen_random_uuid()::text,'EXPIRED','Expired in stock','منتهي الصلاحية بالمخزون',false,true,true,99,now(),now())
ON CONFLICT ("code") DO NOTHING;
