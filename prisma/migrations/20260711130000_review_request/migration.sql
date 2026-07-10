-- #188 Post-delivery review requests: mark when an order's review request was sent.
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "reviewRequestSentAt" TIMESTAMP(3);
