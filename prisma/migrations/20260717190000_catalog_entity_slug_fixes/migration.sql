-- V7 catalog audit (C1/C4/C6) — one-time DATA fix, no schema changes.
--
-- Idempotent: every statement is a no-op once applied, and on a store whose
-- catalog never had the WooCommerce-imported rows (veeey.net) it does nothing.
-- MUST ship together with the ingest decoders (decode-entities.ts wired into
-- wc-sync): the sync rewrites nameEn on every run and matches categories by
-- slug, so without the decoders the next sync would re-escape these names and
-- re-create the fixed categories as encoded duplicates.

-- ── C1: entity-escaped names ────────────────────────────────────────────────
-- WordPress hands titles over escaped ("Pain &amp; Relief"); 218 products,
-- 6 brands and 14 categories stored them verbatim. The ONLY entity present in
-- production data is &amp; (probed 2026-07-17, zero double-escapes), so a
-- targeted replace is exact — anything fancier would be guessing.
UPDATE "Product"  SET "nameEn" = replace("nameEn", '&amp;', '&') WHERE "nameEn" LIKE '%&amp;%';
UPDATE "Category" SET "nameEn" = replace("nameEn", '&amp;', '&') WHERE "nameEn" LIKE '%&amp;%';
UPDATE "Brand"    SET "nameEn"     = replace("nameEn", '&amp;', '&'),
                      "legacyName" = replace("legacyName", '&amp;', '&')
 WHERE "nameEn" LIKE '%&amp;%' OR "legacyName" LIKE '%&amp;%';

-- ── C4: percent-encoded category slugs (2 rows) ─────────────────────────────
-- Encoded slugs can never match a lookup: Next decodes query params before
-- they reach the category loader. Re-slug to the decoded Arabic; a Redirect
-- row (the exact format the loader resolves) keeps raw old links working.
-- Collision guards make a partial re-run safe.
UPDATE "Category" SET "slug" = 'دعم-الغدة-الدرقية'
 WHERE "slug" = '%d8%af%d8%b9%d9%85-%d8%a7%d9%84%d8%ba%d8%af%d8%a9-%d8%a7%d9%84%d8%af%d8%b1%d9%82%d9%8a%d8%a9'
   AND NOT EXISTS (SELECT 1 FROM "Category" c2 WHERE c2."slug" = 'دعم-الغدة-الدرقية');

UPDATE "Category" SET "slug" = 'مكافحة-الشيخوخة'
 WHERE "slug" = '%d9%85%d9%83%d8%a7%d9%81%d8%ad%d8%a9-%d8%a7%d9%84%d8%b4%d9%8a%d8%ae%d9%88%d8%ae%d8%a9'
   AND NOT EXISTS (SELECT 1 FROM "Category" c2 WHERE c2."slug" = 'مكافحة-الشيخوخة');

INSERT INTO "Redirect" ("id", "fromPath", "toPath", "statusCode", "createdAt")
SELECT 'redir_v7c4_thyroid',
       '/products?category=%d8%af%d8%b9%d9%85-%d8%a7%d9%84%d8%ba%d8%af%d8%a9-%d8%a7%d9%84%d8%af%d8%b1%d9%82%d9%8a%d8%a9',
       '/products?category=دعم-الغدة-الدرقية', 301, CURRENT_TIMESTAMP
 WHERE EXISTS (SELECT 1 FROM "Category" WHERE "slug" = 'دعم-الغدة-الدرقية')
ON CONFLICT ("fromPath") DO NOTHING;

INSERT INTO "Redirect" ("id", "fromPath", "toPath", "statusCode", "createdAt")
SELECT 'redir_v7c4_antiaging',
       '/products?category=%d9%85%d9%83%d8%a7%d9%81%d8%ad%d8%a9-%d8%a7%d9%84%d8%b4%d9%8a%d8%ae%d9%88%d8%ae%d8%a9',
       '/products?category=مكافحة-الشيخوخة', 301, CURRENT_TIMESTAMP
 WHERE EXISTS (SELECT 1 FROM "Category" WHERE "slug" = 'مكافحة-الشيخوخة')
ON CONFLICT ("fromPath") DO NOTHING;

-- ── C6: the "pain-releif" typo (category + its AR twin) ─────────────────────
-- The correctly-spelled slug does not exist (probed), so the rename is safe;
-- the guard keeps a re-run (or an unexpected twin) from violating uniqueness.
-- The name's own "&amp;" is already fixed by the C1 block above.
UPDATE "Category" SET "slug" = 'pain-relief'
 WHERE "slug" = 'pain-releif'
   AND NOT EXISTS (SELECT 1 FROM "Category" c2 WHERE c2."slug" = 'pain-relief');

UPDATE "Category" SET "slug" = 'pain-relief-ar-2'
 WHERE "slug" = 'pain-releif-ar-2'
   AND NOT EXISTS (SELECT 1 FROM "Category" c2 WHERE c2."slug" = 'pain-relief-ar-2');

INSERT INTO "Redirect" ("id", "fromPath", "toPath", "statusCode", "createdAt")
SELECT 'redir_v7c6_pain', '/products?category=pain-releif', '/products?category=pain-relief', 301, CURRENT_TIMESTAMP
 WHERE EXISTS (SELECT 1 FROM "Category" WHERE "slug" = 'pain-relief')
ON CONFLICT ("fromPath") DO NOTHING;

INSERT INTO "Redirect" ("id", "fromPath", "toPath", "statusCode", "createdAt")
SELECT 'redir_v7c6_pain_ar', '/products?category=pain-releif-ar-2', '/products?category=pain-relief-ar-2', 301, CURRENT_TIMESTAMP
 WHERE EXISTS (SELECT 1 FROM "Category" WHERE "slug" = 'pain-relief-ar-2')
ON CONFLICT ("fromPath") DO NOTHING;
