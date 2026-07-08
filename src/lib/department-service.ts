import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { PERMISSION_KEYS, PERMISSION_CATALOG, type PermissionKey } from '@/lib/permissions';

/**
 * Departments/Teams (TEAM epic, FR-RBAC) — replace the single-role model.
 * Each department carries an editable permission set; a staff member belongs
 * to one or many; effective permissions = UNION across memberships (resolved
 * at sign-in in auth.ts). The 'sales' department drives the order
 * pharmacist/handler picker. Gated by `rbac.manage`, audited.
 */
const PERM = 'rbac.manage';

export const SALES_DEPARTMENT_KEY = 'sales';

export const listDepartments = () =>
  prisma.department.findMany({
    include: { permissions: true, _count: { select: { members: true } } },
    orderBy: { nameEn: 'asc' },
  });

export const getDepartment = (id: string) =>
  prisma.department.findUnique({
    where: { id },
    include: { permissions: true, members: { include: { user: { select: { id: true, name: true, email: true } } } } },
  });

const deptSchema = z.object({
  key: z.string().trim().min(1).regex(/^[a-z0-9_-]+$/, 'lowercase key'),
  nameEn: z.string().trim().min(1),
  nameAr: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  permissionKeys: z.array(z.string()).default([]),
});
export type DepartmentInput = z.input<typeof deptSchema>;

/** Ensure Permission rows exist for the given catalog keys; returns their ids. */
async function permissionIds(keys: string[]): Promise<string[]> {
  const valid = keys.filter((k): k is PermissionKey => (PERMISSION_KEYS as string[]).includes(k));
  const ids: string[] = [];
  for (const key of valid) {
    const p = await prisma.permission.upsert({
      where: { key },
      update: {},
      create: { key, description: PERMISSION_CATALOG[key as PermissionKey] ?? null },
      select: { id: true },
    });
    ids.push(p.id);
  }
  return ids;
}

export async function saveDepartment(id: string | null, raw: DepartmentInput) {
  const actor = await requirePermission(PERM);
  const d = deptSchema.parse(raw);
  const perms = await permissionIds(d.permissionKeys);
  const data = {
    key: d.key,
    nameEn: d.nameEn,
    nameAr: d.nameAr ?? null,
    description: d.description ?? null,
    permissions: { set: perms.map((pid) => ({ id: pid })) },
  };
  const dept = id
    ? await prisma.department.update({ where: { id }, data })
    : await prisma.department.create({ data: { ...data, permissions: { connect: perms.map((pid) => ({ id: pid })) } } });
  await audit({ actorType: 'USER', actorId: actor.id, action: id ? 'department.update' : 'department.create', entityType: 'Department', entityId: dept.id, data: { permissions: d.permissionKeys.length } });
  return dept;
}

export async function deleteDepartment(id: string) {
  const actor = await requirePermission(PERM);
  const members = await prisma.departmentMember.count({ where: { departmentId: id } });
  if (members > 0) throw new Error('IN_USE'); // reassign staff first — never silently drop access
  await prisma.department.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: actor.id, action: 'department.delete', entityType: 'Department', entityId: id });
}

/** Replace a user's memberships with the given department ids. */
export async function setUserDepartments(userId: string, departmentIds: string[]) {
  const actor = await requirePermission(PERM);
  await prisma.departmentMember.deleteMany({ where: { userId, departmentId: { notIn: departmentIds } } });
  for (const departmentId of departmentIds) {
    await prisma.departmentMember.upsert({
      where: { departmentId_userId: { departmentId, userId } },
      update: {},
      create: { departmentId, userId },
    });
  }
  await audit({ actorType: 'USER', actorId: actor.id, action: 'staff.departments', entityType: 'User', entityId: userId, data: { departments: departmentIds.length } });
}

/** Staff = anyone in at least one department (legacy roleId kept as fallback
 *  until every account is migrated — the migration copied all assignments). */
export const staffWhere: Prisma.UserWhereInput = { OR: [{ departments: { some: {} } }, { roleId: { not: null } }] };

/** Members of the Sales department — the order pharmacist/handler picker
 *  (owner rule). Falls back to all staff while Sales has no members. */
export async function salesStaff(): Promise<{ id: string; name: string | null; email: string | null }[]> {
  const sales = await prisma.user.findMany({
    where: { departments: { some: { department: { key: SALES_DEPARTMENT_KEY } } } },
    select: { id: true, name: true, email: true },
    orderBy: { name: 'asc' },
  });
  if (sales.length) return sales;
  return prisma.user.findMany({ where: staffWhere, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } });
}
