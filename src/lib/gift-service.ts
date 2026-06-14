import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';

/** Gifts (FR-ORD-10) — separate code-named (Gx-*) inventory, 0-value to the
 *  customer, hidden everywhere customer-facing; cost booked as promo expense. */

export const listGifts = () => prisma.gift.findMany({ orderBy: { createdAt: 'desc' } });
export const getGift = (id: string) => prisma.gift.findUnique({ where: { id } });

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
  const gift = id ? await prisma.gift.update({ where: { id }, data }) : await prisma.gift.create({ data });
  await audit({ actorType: 'USER', actorId: user.id, action: id ? 'gift.update' : 'gift.create', entityType: 'Gift', entityId: gift.id });
  return gift;
}
