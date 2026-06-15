import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { hashPassword } from '@/lib/password';

/**
 * Staff account management (FR-RBAC-*). Create staff users and assign roles.
 * Gated by `rbac.manage`, audited. "Revoke access" demotes to a plain account
 * (roleId = null) rather than deleting — preserves order/audit references.
 */
const PERM = 'rbac.manage';

export const listStaff = () =>
  prisma.user.findMany({
    where: { roleId: { not: null } },
    include: { role: true },
    orderBy: { createdAt: 'desc' },
  });

export const getStaff = (id: string) =>
  prisma.user.findUnique({ where: { id }, include: { role: true } });

export const listRolesForAssign = () => prisma.role.findMany({ orderBy: { key: 'asc' } });

const createSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(8),
  roleId: z.string().trim().min(1),
});
export type StaffCreateInput = z.input<typeof createSchema>;

export async function createStaff(raw: StaffCreateInput) {
  const actor = await requirePermission(PERM);
  const d = createSchema.parse(raw);
  const email = d.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('EXISTS');
  const passwordHash = await hashPassword(d.password);
  const user = await prisma.user.create({ data: { name: d.name, email, passwordHash, roleId: d.roleId } });
  await audit({ actorType: 'USER', actorId: actor.id, action: 'staff.create', entityType: 'User', entityId: user.id });
  return user;
}

const updateSchema = z.object({
  name: z.string().trim().min(1),
  roleId: z.string().trim().min(1),
  password: z.string().min(8).optional().or(z.literal('')),
});
export type StaffUpdateInput = z.input<typeof updateSchema>;

export async function updateStaff(id: string, raw: StaffUpdateInput) {
  const actor = await requirePermission(PERM);
  const d = updateSchema.parse(raw);
  const data: { name: string; roleId: string; passwordHash?: string } = { name: d.name, roleId: d.roleId };
  if (d.password) data.passwordHash = await hashPassword(d.password);
  const user = await prisma.user.update({ where: { id }, data });
  await audit({ actorType: 'USER', actorId: actor.id, action: 'staff.update', entityType: 'User', entityId: id });
  return user;
}

export async function revokeStaff(id: string) {
  const actor = await requirePermission(PERM);
  if (actor.id === id) throw new Error('SELF'); // never lock yourself out
  const user = await prisma.user.update({ where: { id }, data: { roleId: null } });
  await audit({ actorType: 'USER', actorId: actor.id, action: 'staff.revoke', entityType: 'User', entityId: id });
  return user;
}
