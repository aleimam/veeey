-- Pre-order flag: products may be shown on the storefront while out of stock.
ALTER TABLE "Product" ADD COLUMN "preorderEnabled" BOOLEAN NOT NULL DEFAULT false;
