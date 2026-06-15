-- Soft-delete support: nullable archive timestamps on taxonomy + gifts.
-- (Status-enum entities use ARCHIVED; coupons use the existing `active` flag.)
ALTER TABLE "Brand" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Category" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Tag" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Attribute" ADD COLUMN "archivedAt" TIMESTAMP(3);
ALTER TABLE "Gift" ADD COLUMN "archivedAt" TIMESTAMP(3);
