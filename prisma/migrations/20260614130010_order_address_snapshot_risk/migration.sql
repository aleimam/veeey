-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "riskScore" INTEGER,
ADD COLUMN     "shippingAddressJson" JSONB;
