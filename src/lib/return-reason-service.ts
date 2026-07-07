import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/**
 * Managed return reasons (FR-RET). Admin-editable, bilingual list the
 * return-creation dropdown reads from. Soft-deactivate (active=false) keeps
 * historical returns' reasons intact instead of hard-deleting.
 */
export const listReturnReasons = (activeOnly = false) =>
  prisma.returnReason.findMany({
    where: activeOnly ? { active: true } : {},
    orderBy: [{ active: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

export const getReturnReason = (id: string) => prisma.returnReason.findUnique({ where: { id } });

const reasonSchema = z.object({
  labelEn: z.string().trim().min(1),
  labelAr: z.string().trim().min(1),
  sortOrder: z.coerce.number().int().default(0),
  requiresDetail: z.boolean().default(false),
});
export type ReturnReasonInput = z.input<typeof reasonSchema>;

export async function createReturnReason(raw: ReturnReasonInput) {
  const user = await requirePermission('returns.manage');
  const data = reasonSchema.parse(raw);
  const r = await prisma.returnReason.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: 'return_reason.create', entityType: 'ReturnReason', entityId: r.id });
  return r;
}

/** Update the editable fields only — `active` is managed by setReturnReasonActive. */
export async function updateReturnReason(id: string, raw: ReturnReasonInput) {
  const user = await requirePermission('returns.manage');
  const data = reasonSchema.parse(raw);
  await prisma.returnReason.update({ where: { id }, data });
  await audit({ actorType: 'USER', actorId: user.id, action: 'return_reason.update', entityType: 'ReturnReason', entityId: id });
}

export async function setReturnReasonActive(id: string, active: boolean) {
  const user = await requirePermission('returns.manage');
  await prisma.returnReason.update({ where: { id }, data: { active } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'return_reason.active', entityType: 'ReturnReason', entityId: id, data: { active } });
}
