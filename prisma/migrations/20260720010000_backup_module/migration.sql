-- Off-site backup module (BACKUP.md).
-- Hand-written and fully guarded per the deploy rules: every statement is
-- IF NOT EXISTS so re-running it is a no-op and it can never take a store down.

CREATE TABLE IF NOT EXISTS "BackupConfig" (
    "id"              TEXT NOT NULL,
    "singleton"       TEXT NOT NULL DEFAULT 'BACKUP',
    "enabled"         BOOLEAN NOT NULL DEFAULT false,
    "protocol"        TEXT NOT NULL DEFAULT 'SFTP',
    "host"            TEXT,
    "port"            INTEGER NOT NULL DEFAULT 23,
    "username"        TEXT,
    "passwordEnc"     TEXT,
    "remotePath"      TEXT NOT NULL DEFAULT '/home',
    "secure"          BOOLEAN NOT NULL DEFAULT true,
    "notifyOnFailure" BOOLEAN NOT NULL DEFAULT true,
    "lastTestAt"      TIMESTAMP(3),
    "lastTestOk"      BOOLEAN,
    "lastTestMessage" TEXT,
    "lastRunAt"       TIMESTAMP(3),
    "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupConfig_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BackupConfig_singleton_key" ON "BackupConfig"("singleton");

CREATE TABLE IF NOT EXISTS "BackupTier" (
    "id"         TEXT NOT NULL,
    "key"        TEXT NOT NULL,
    "enabled"    BOOLEAN NOT NULL DEFAULT true,
    "frequency"  TEXT NOT NULL DEFAULT 'DAILY',
    "everyN"     INTEGER NOT NULL DEFAULT 1,
    "hourUtc"    INTEGER NOT NULL DEFAULT 2,
    "weekday"    INTEGER NOT NULL DEFAULT 0,
    "dayOfMonth" INTEGER NOT NULL DEFAULT 1,
    "contents"   TEXT NOT NULL DEFAULT 'FULL',
    "remotePath" TEXT NOT NULL DEFAULT '/home',
    "keepLast"   INTEGER NOT NULL DEFAULT 7,
    "sortOrder"  INTEGER NOT NULL DEFAULT 0,
    "lastRunAt"  TIMESTAMP(3),
    "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BackupTier_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "BackupTier_key_key" ON "BackupTier"("key");
CREATE INDEX IF NOT EXISTS "BackupTier_sortOrder_idx" ON "BackupTier"("sortOrder");

CREATE TABLE IF NOT EXISTS "BackupRun" (
    "id"         TEXT NOT NULL,
    "tierKey"    TEXT,
    "startedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status"     TEXT NOT NULL,
    "trigger"    TEXT NOT NULL,
    "contents"   TEXT NOT NULL DEFAULT '',
    "fileName"   TEXT,
    "sizeBytes"  BIGINT,
    "error"      TEXT,
    CONSTRAINT "BackupRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "BackupRun_startedAt_idx" ON "BackupRun"("startedAt");
