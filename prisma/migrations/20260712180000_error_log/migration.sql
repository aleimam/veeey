-- System error / mistake log (admin-toggleable).
CREATE TABLE IF NOT EXISTS "ErrorLog" (
  "id" TEXT NOT NULL,
  "level" TEXT NOT NULL,
  "message" TEXT NOT NULL,
  "source" TEXT,
  "stack" TEXT,
  "metaJson" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ErrorLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "ErrorLog_createdAt_idx" ON "ErrorLog"("createdAt");
CREATE INDEX IF NOT EXISTS "ErrorLog_level_idx" ON "ErrorLog"("level");
