import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { hashPassword } from '@/lib/password';
import { staffWhere } from '@/lib/department-service';

/**
 * Staff account management (FR-RBAC-*, TEAM epic). Staff belong to one or many
 * DEPARTMENTS; effective permissions = union across memberships (resolved at
 * sign-in). Gated by `rbac.manage`, audited. "Revoke access" removes every
 * membership (and clears the legacy roleId) rather than deleting — preserves
 * order/audit references.
 */
const PERM = 'rbac.manage';

export const listStaff = () =>
  prisma.user.findMany({
    where: staffWhere,
    include: { departments: { include: { department: { select: { id: true, nameEn: true, key: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

export const getStaff = (id: string) =>
  prisma.user.findUnique({
    where: { id },
    include: { departments: { include: { department: { select: { id: true, nameEn: true, key: true } } } } },
  });

export const listDepartmentsForAssign = () =>
  prisma.department.findMany({ select: { id: true, key: true, nameEn: true, nameAr: true }, orderBy: { nameEn: 'asc' } });

async function syncMemberships(userId: string, departmentIds: string[]) {
  await prisma.departmentMember.deleteMany({ where: { userId, departmentId: { notIn: departmentIds } } });
  for (const departmentId of departmentIds) {
    await prisma.departmentMember.upsert({
      where: { departmentId_userId: { departmentId, userId } },
      update: {},
      create: { departmentId, userId },
    });
  }
}

const createSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
  departmentIds: z.array(z.string().min(1)).min(1),
});
export type StaffCreateInput = z.input<typeof createSchema>;

export async function createStaff(raw: StaffCreateInput) {
  const actor = await requirePermission(PERM);
  const d = createSchema.parse(raw);
  const email = d.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('EXISTS');
  const passwordHash = await hashPassword(d.password);
  const user = await prisma.user.create({ data: { name: d.name, email, passwordHash } });
  await syncMemberships(user.id, d.departmentIds);
  await audit({ actorType: 'USER', actorId: actor.id, action: 'staff.create', entityType: 'User', entityId: user.id, data: { departments: d.departmentIds.length } });
  return user;
}

const updateSchema = z.object({
  name: z.string().trim().min(1),
  departmentIds: z.array(z.string().min(1)).min(1),
  password: z.string().min(8).optional().or(z.literal('')),
});
export type StaffUpdateInput = z.input<typeof updateSchema>;

export async function updateStaff(id: string, raw: StaffUpdateInput) {
  const actor = await requirePermission(PERM);
  const d = updateSchema.parse(raw);
  const data: { name: string; passwordHash?: string } = { name: d.name };
  if (d.password) data.passwordHash = await hashPassword(d.password);
  const user = await prisma.user.update({ where: { id }, data });
  await syncMemberships(id, d.departmentIds);
  await audit({ actorType: 'USER', actorId: actor.id, action: 'staff.update', entityType: 'User', entityId: id, data: { departments: d.departmentIds.length } });
  return user;
}

export async function revokeStaff(id: string) {
  const actor = await requirePermission(PERM);
  if (actor.id === id) throw new Error('SELF'); // never lock yourself out
  await prisma.departmentMember.deleteMany({ where: { userId: id } });
  const user = await prisma.user.update({ where: { id }, data: { roleId: null } });
  await audit({ actorType: 'USER', actorId: actor.id, action: 'staff.revoke', entityType: 'User', entityId: id });
  return user;
}
