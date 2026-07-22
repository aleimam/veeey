-- Tombstones for customer accounts deleted as junk (owner 2026-07-22).
-- Without these the hourly WordPress customer pull re-imports every spam
-- signup we delete, because it is idempotent on legacyWpId / email.
-- Idempotent: safe to re-run on a database that already has the table.
CREATE TABLE IF NOT EXISTS "DeletedSpamAccount" (
  "id"            TEXT NOT NULL,
  "email"         TEXT,
  "legacyWpId"    INTEGER,
  "reasons"       TEXT NOT NULL DEFAULT '',
  "deletedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deletedByUser" TEXT,
  CONSTRAINT "DeletedSpamAccount_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DeletedSpamAccount_email_key" ON "DeletedSpamAccount"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "DeletedSpamAccount_legacyWpId_key" ON "DeletedSpamAccount"("legacyWpId");
CREATE INDEX IF NOT EXISTS "DeletedSpamAccount_deletedAt_idx" ON "DeletedSpamAccount"("deletedAt");
