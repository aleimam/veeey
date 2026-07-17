-- Register the `requests.manage` permission and grant it wherever `orders.write`
-- is already granted (super_admin, admin, Sales/pharmacist roles + departments).
--
-- WHY a data migration: deploy runs `prisma migrate deploy`, NOT the seed, and a
-- user's effective permissions come purely from DB Permission rows connected to
-- their role/department (auth.ts — no runtime admin wildcard). Adding the key to
-- the catalog alone would 403 EVERYONE (owner included) out of /admin/requests.
-- Idempotent + no-op on a freshly-seeded store (rows already exist).

INSERT INTO "Permission" ("id", "key", "description")
VALUES ('perm_requests_manage', 'requests.manage', 'Place & manage purchasing requests')
ON CONFLICT ("key") DO NOTHING;

-- Roles: connect requests.manage to every role that can already write orders.
-- (_RolePermissions: A = Permission.id, B = Role.id)
INSERT INTO "_RolePermissions" ("A", "B")
SELECT rm."id", roles.role_id
FROM "Permission" rm
CROSS JOIN (
  SELECT rp."B" AS role_id
  FROM "_RolePermissions" rp
  JOIN "Permission" p ON p."id" = rp."A"
  WHERE p."key" = 'orders.write'
) roles
WHERE rm."key" = 'requests.manage'
ON CONFLICT ("A", "B") DO NOTHING;

-- Departments: same rule (_DepartmentPermissions: A = Department.id, B = Permission.id)
INSERT INTO "_DepartmentPermissions" ("A", "B")
SELECT depts.dept_id, rm."id"
FROM "Permission" rm
CROSS JOIN (
  SELECT dp."A" AS dept_id
  FROM "_DepartmentPermissions" dp
  JOIN "Permission" p ON p."id" = dp."B"
  WHERE p."key" = 'orders.write'
) depts
WHERE rm."key" = 'requests.manage'
ON CONFLICT ("A", "B") DO NOTHING;
