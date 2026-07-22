-- Checkout backlog (owner feedback 2026-07-22) — schema for P0/P1/P2.
-- Idempotent throughout; safe on both stores.

-- 1. AWAITING_PAYMENT status (P0): an online-payment order lives here between
--    placement and the gateway webhook. Excluded from the default admin list and
--    sales analytics; the sweep cancels (and restocks) it when the gateway
--    session lapses. Reachable next: PENDING (paid) or CANCELLED (abandoned).
INSERT INTO "OrderStatusConfig"
  ("id","code","labelEn","labelAr","customerCode","icon","stockEffect","paymentEffect","revenueEffect","loyaltyEffect","notifyAudience","notifyTemplateKey","advancePermission","fastAction","allowedNext","sourceAliases","sortOrder","active","isDefault","createdAt","updatedAt")
SELECT gen_random_uuid()::text,'AWAITING_PAYMENT','Awaiting payment','بانتظار الدفع','PENDING','credit-card','none','none','none','none','none',NULL,NULL,false,
       ARRAY['PENDING','CANCELLED']::text[], ARRAY['awaiting-payment','awaiting_payment']::text[], 0, true, false, now(), now()
WHERE NOT EXISTS (SELECT 1 FROM "OrderStatusConfig" WHERE "code" = 'AWAITING_PAYMENT');

-- 2. Numeric order numbers (P1): one per-store sequence. Seeded above BOTH the
--    1,000,000 floor and any existing purely-numeric order number (the WP order
--    import carries raw numeric ids), so new numbers can never collide with
--    history. Cross-store uniqueness is NOT needed — YeldnIN correlates on
--    (storeKey, orderNumber).
CREATE SEQUENCE IF NOT EXISTS "order_number_seq" START WITH 1000001;
DO $$
DECLARE max_numeric BIGINT;
BEGIN
  SELECT COALESCE(MAX("number"::BIGINT), 0) INTO max_numeric
    FROM "Order" WHERE "number" ~ '^[0-9]{1,15}$';
  PERFORM setval('order_number_seq', GREATEST(max_numeric, 1000000));
END $$;

-- 3. Set/reset-password tokens (P2 — guest→account set-password link).
CREATE TABLE IF NOT EXISTS "PasswordResetToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX IF NOT EXISTS "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'PasswordResetToken_userId_fkey') THEN
    ALTER TABLE "PasswordResetToken"
      ADD CONSTRAINT "PasswordResetToken_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
