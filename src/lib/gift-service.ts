import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';

/** Gifts (FR-ORD-10) — separate code-named (Gx-*) inventory, 0-value to the
 *  customer, hidden everywhere customer-facing; cost booked as promo expense.
 *  Stock is a counter (NOT lot-tracked); every change lands in GiftMovement. */

export const listGifts = () => prisma.gift.findMany({ orderBy: { createdAt: 'desc' } });
export const getGift = (id: string) => prisma.gift.findUnique({ where: { id } });

/** Recent stock movements for one gift (newest first). */
export const listGiftMovements = (giftId: string, take = 50) =>
  prisma.giftMovement.findMany({ where: { giftId }, orderBy: { createdAt: 'desc' }, take });

const giftSchema = z.object({
  code: z.string().trim().min(1),
  internalName: z.string().trim().min(1),
  stock: z.coerce.number().int().nonnegative().default(0),
  expiry: z.string().optional().nullable(),
  costEgp: z.coerce.number().nonnegative().optional().nullable(),
});
export type GiftInput = z.input<typeof giftSchema>;

export async function saveGift(id: string | null, raw: GiftInput) {
  const user = await requirePermission('orders.write');
  const d = giftSchema.parse(raw);
  const data = {
    code: d.code,
    internalName: d.internalName,
    stock: d.stock,
    expiry: d.expiry ? new Date(d.expiry) : null,
    costPiastres: d.costEgp != null ? egpToPiastres(d.costEgp) : null,
  };
  const gift = await prisma.$transaction(async (tx) => {
    const before = id ? await tx.gift.findUniqueOrThrow({ where: { id }, select: { stock: true } }) : null;
    const saved = id ? await tx.gift.update({ where: { id }, data }) : await tx.gift.create({ data });
    const delta = d.stock - (before?.stock ?? 0);
    if (delta !== 0) {
      await tx.giftMovement.create({
        data: { giftId: saved.id, type: 'ADJUST', qtyDelta: delta, refType: 'manual', refId: user.id, note: id ? 'Stock edited in gift form' : 'Initial stock' },
      });
    }
    return saved;
  });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'gift.update' : 'gift.create', entityType: 'Gift', entityId: gift.id });
  return gift;
}
