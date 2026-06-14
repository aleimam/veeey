-- AlterTable: cached AI review summary (FR-REV-04)
ALTER TABLE "Product" ADD COLUMN "aiReviewSummary" TEXT;
ALTER TABLE "Product" ADD COLUMN "aiReviewSummaryAt" TIMESTAMP(3);
