import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { InUseError } from '@/lib/soft-delete-service';
import { PERMISSION_KEYS } from '@/lib/permissions';

/**
 * Role + permission management (FR-RBAC-01/02). Roles are admin-configurable;
 * permissions are the seeded PERMISSION_CATALOG keys connected m2m. Gated by
 * `rbac.manage`, audited. super_admin is protected from deletion.
 */
const PERM = 'rbac.manage';

export const listRoles = () =>
  prisma.role.findMany({
    orderBy: { key: 'asc' },
    include: { _count: { select: { users: true, permissions: true } } },
  });

export const getRole = (id: string) =>
  prisma.role.findUnique({ where: { id }, include: { permissions: { select: { key: true } } } });

const roleSchema = z.object({
  key: z.string().trim().min(1),
  name: z.string().trim().min(1),
  description: z.string().trim().optional().nullable(),
  permissionKeys: z.array(z.string()).default([]),
});
export type RoleInput = z.input<typeof roleSchema>;

export async function saveRole(id: string | null, raw: RoleInput) {
  const actor = await requirePermission(PERM);
  const d = roleSchema.parse(raw);
  // Only persist real catalog keys (ignore anything stale/injected).
  const keys = d.permissionKeys.filter((k): k is (typeof PERMISSION_KEYS)[number] => (PERMISSION_KEYS as string[]).includes(k));
  const connect = keys.map((key) => ({ key }));

  const role = id
    ? await prisma.role.update({
        where: { id },
        data: { key: d.key, name: d.name, description: d.description ?? null, permissions: { set: connect } },
      })
    : await prisma.role.create({
        data: { key: d.key, name: d.name, description: d.description ?? null, permissions: { connect } },
      });
  await audit({ actorType: 'USER', actorId: actor.id, action: id ? 'role.update' : 'role.create', entityType: 'Role', entityId: role.id });
  return role;
}

export async function deleteRole(id: string) {
  const actor = await requirePermission(PERM);
  const role = await prisma.role.findUnique({ where: { id }, include: { _count: { select: { users: true } } } });
  if (!role) return null;
  if (role.key === 'super_admin') throw new InUseError(); // protected
  if (role._count.users > 0) throw new InUseError();
  const deleted = await prisma.role.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: actor.id, action: 'role.delete', entityType: 'Role', entityId: id });
  return deleted;
}
