-- Split the "Bank Transfer / InstaPay / Wallet" checkout radio into three
-- (owner 2026-07-23). The SEED in payment-method-service only runs on an empty
-- table, so an existing store needs its rows remapped here.
--
-- Idempotent throughout: this schema is applied by hand on two boxes.
--
-- ⚠️ `Order.paymentMethod` is deliberately NOT touched. Past orders keep
-- 'BANK_TRANSFER', which still exists as a customer-facing code — rewriting them
-- would claim we know which of the three a 2024 customer actually used.

-- 1. The wallet row now points at its own customer-facing method.
UPDATE "SystemPaymentMethod"
   SET "customerCode" = 'MOBILE_WALLET', "updatedAt" = NOW()
 WHERE "code" = 'WALLET' AND "customerCode" = 'BANK_TRANSFER';

-- 2. InstaPay becomes its own system method. Fixed id so a re-run is a no-op
--    (the table has no DB-side default for `id`; Prisma mints cuids at runtime).
INSERT INTO "SystemPaymentMethod" ("id", "code", "labelEn", "labelAr", "customerCode", "courier", "sourceAliases", "active", "sortOrder", "createdAt", "updatedAt")
VALUES ('sysm_instapay', 'INSTAPAY', 'InstaPay (IPN)', 'إنستاباي (IPN)', 'INSTAPAY', NULL,
        ARRAY['instapay', 'instapay_alex', 'ipn'], true, 11, NOW(), NOW())
ON CONFLICT ("code") DO NOTHING;

-- 3. The bank rows stop claiming InstaPay — both in their label and in the
--    aliases that classify imported orders.
UPDATE "SystemPaymentMethod"
   SET "labelEn" = 'Bank Transfer (Alex Bank)', "labelAr" = 'تحويل بنكي (بنك الإسكندرية)',
       "sourceAliases" = ARRAY['alexbank', 'bank_alex'], "updatedAt" = NOW()
 WHERE "code" = 'BANK_ALEX';

UPDATE "SystemPaymentMethod"
   SET "labelEn" = 'Bank Transfer (Other Banks)', "labelAr" = 'تحويل بنكي (بنوك أخرى)',
       "sourceAliases" = ARRAY['bacs', 'bank', 'bank_transfer'], "updatedAt" = NOW()
 WHERE "code" = 'BANK_OTHER';

-- 4. Widen the wallet aliases to the four Egyptian wallets the checkout now names.
UPDATE "SystemPaymentMethod"
   SET "sourceAliases" = ARRAY['wallet', 'vodafone_cash', 'orange_cash', 'etisalat_flous', 'we_pay', 'fawry', 'mobile_wallet'],
       "sortOrder" = 12, "updatedAt" = NOW()
 WHERE "code" = 'WALLET';
