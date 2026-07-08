-- Departments/Teams replace Roles (TEAM epic). Non-destructive: Role and
-- User.roleId stay in place as a legacy fallback; the app reads departments.
CREATE TABLE IF NOT EXISTS "Department" (
  "id"          TEXT NOT NULL,
  "key"         TEXT NOT NULL,
  "nameEn"      TEXT NOT NULL,
  "nameAr"      TEXT,
  "description" TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "Department_key_key" ON "Department"("key");

CREATE TABLE IF NOT EXISTS "DepartmentMember" (
  "id"           TEXT NOT NULL,
  "departmentId" TEXT NOT NULL,
  "userId"       TEXT NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DepartmentMember_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "DepartmentMember"
    ADD CONSTRAINT "DepartmentMember_departmentId_fkey"
    FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "DepartmentMember"
    ADD CONSTRAINT "DepartmentMember_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE UNIQUE INDEX IF NOT EXISTS "DepartmentMember_departmentId_userId_key" ON "DepartmentMember"("departmentId", "userId");
CREATE INDEX IF NOT EXISTS "DepartmentMember_userId_idx" ON "DepartmentMember"("userId");

-- Implicit M2M join table (Prisma convention: A/B ordered by model name —
-- Department < Permission).
CREATE TABLE IF NOT EXISTS "_DepartmentPermissions" (
  "A" TEXT NOT NULL,
  "B" TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "_DepartmentPermissions_AB_unique" ON "_DepartmentPermissions"("A", "B");
CREATE INDEX IF NOT EXISTS "_DepartmentPermissions_B_index" ON "_DepartmentPermissions"("B");
DO $$ BEGIN
  ALTER TABLE "_DepartmentPermissions"
    ADD CONSTRAINT "_DepartmentPermissions_A_fkey"
    FOREIGN KEY ("A") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "_DepartmentPermissions"
    ADD CONSTRAINT "_DepartmentPermissions_B_fkey"
    FOREIGN KEY ("B") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Data migration: every Role becomes a Department (same key/name/permissions),
-- every staff assignment becomes a membership. Idempotent (ON CONFLICT skips).
INSERT INTO "Department" ("id", "key", "nameEn", "description", "createdAt")
SELECT 'dept_' || r."id", r."key", r."name", r."description", r."createdAt"
FROM "Role" r
ON CONFLICT ("key") DO NOTHING;

INSERT INTO "_DepartmentPermissions" ("A", "B")
SELECT d."id", rp."A"
FROM "_RolePermissions" rp
JOIN "Role" r ON r."id" = rp."B"
JOIN "Department" d ON d."key" = r."key"
ON CONFLICT DO NOTHING;

INSERT INTO "DepartmentMember" ("id", "departmentId", "userId")
SELECT 'dm_' || u."id", d."id", u."id"
FROM "User" u
JOIN "Role" r ON r."id" = u."roleId"
JOIN "Department" d ON d."key" = r."key"
WHERE u."roleId" IS NOT NULL
ON CONFLICT ("departmentId", "userId") DO NOTHING;

-- Seed the Sales department (drives the order pharmacist picker) if missing.
INSERT INTO "Department" ("id", "key", "nameEn", "nameAr", "description")
VALUES ('dept_sales_seed', 'sales', 'Sales', 'المبيعات', 'Sales team — members appear in the order pharmacist/handler picker.')
ON CONFLICT ("key") DO NOTHING;
