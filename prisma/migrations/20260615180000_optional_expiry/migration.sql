-- Expiry is optional: non-perishable lots (NA) have no expiry date.
ALTER TABLE "Lot" ALTER COLUMN "expiryDate" DROP NOT NULL;
