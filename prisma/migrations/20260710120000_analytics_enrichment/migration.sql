-- Analytics P1: visitor enrichment. Additive + idempotent — safe to re-run.
-- Extends AnalyticsSession with IP/geo/device/screen fields and AnalyticsEvent
-- with per-page dwell time. Everything is nullable; capture is gated on consent
-- in the app layer.

ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "ip" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "ipTruncated" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "country" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "os" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "osVersion" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "browser" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "browserVersion" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "deviceType" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "isBot" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "language" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "screenW" INTEGER;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "screenH" INTEGER;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "viewportW" INTEGER;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "viewportH" INTEGER;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "landingPath" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "exitPath" TEXT;
ALTER TABLE "AnalyticsSession" ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3);

ALTER TABLE "AnalyticsEvent" ADD COLUMN IF NOT EXISTS "durationMs" INTEGER;

CREATE INDEX IF NOT EXISTS "AnalyticsSession_startedAt_idx" ON "AnalyticsSession" ("startedAt");
CREATE INDEX IF NOT EXISTS "AnalyticsSession_country_idx" ON "AnalyticsSession" ("country");
CREATE INDEX IF NOT EXISTS "AnalyticsSession_deviceType_idx" ON "AnalyticsSession" ("deviceType");
CREATE INDEX IF NOT EXISTS "AnalyticsSession_isBot_idx" ON "AnalyticsSession" ("isBot");
CREATE INDEX IF NOT EXISTS "AnalyticsEvent_createdAt_idx" ON "AnalyticsEvent" ("createdAt");
