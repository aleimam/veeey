import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';
import type { Prisma } from '@/generated/prisma/client';

/** Returns & refunds (FR-RET-*). Returned stock goes to QUARANTINE for pharmacist
 *  review (re-shelf to the correct lot or write off — never auto-resell). */

export async function requestReturn(orderId: string, customerId: string | null, reasonCode: string, items: { orderItemId: string; qty: number }[]) {
  const ret = await prisma.return.create({
    data: { orderId, customerId, reasonCode, status: 'REQUESTED', items: { create: items.map((i) => ({ orderItemId: i.orderItemId, qty: i.qty, disposition: 'PENDING' })) } },
  });
  await audit({ actorType: customerId ? 'CUSTOMER' : 'USER', actorId: customerId, action: 'return.request', entityType: 'Return', entityId: ret.id });
  return ret;
}

export const listReturns = ({ status, q }: { status?: string; q?: string } = {}) =>
  prisma.return.findMany({
    where: {
      ...(status ? { status: status as Prisma.ReturnWhereInput['status'] } : {}),
      ...(q ? { order: { number: { contains: q, mode: 'insensitive' } } } : {}),
    },
    include: { order: { select: { number: true } }, items: true },
    orderBy: { createdAt: 'desc' },
  });

export const getReturn = (id: string) =>
  prisma.return.findUnique({ where: { id }, include: { order: { select: { number: true } }, items: { include: { orderItem: { include: { product: { select: { nameEn: true } }, lot: true } } } } } });

export async function processReturn(
  id: string,
  input: { status: 'QUARANTINE' | 'RESTOCKED' | 'WRITTEN_OFF' | 'REFUNDED' | 'REJECTED'; refundMethod?: string; refundEgp?: number | null; dispositions?: { returnItemId: string; disposition: 'RESTOCK' | 'WRITE_OFF' | 'PENDING' }[] },
) {
  const user = await requirePermission('returns.manage');
  await prisma.$transaction(async (tx) => {
    for (const d of input.dispositions ?? []) {
      const ri = await tx.returnItem.findUniqueOrThrow({ where: { id: d.returnItemId }, include: { orderItem: { include: { lot: true } } } });
      await tx.returnItem.update({ where: { id: d.returnItemId }, data: { disposition: d.disposition } });
      const lot = ri.orderItem.lot;
      if (d.disposition === 'RESTOCK' && lot) {
        // Return to a NEW quarantine lot (pharmacist re-shelves to live later).
        const qLot = await tx.lot.create({ data: { productId: ri.orderItem.productId, locationId: lot.locationId, expiryDate: lot.expiryDate, qtyOnHand: ri.qty, status: 'QUARANTINE' } });
        await tx.movementLedger.create({ data: { lotId: qLot.id, locationId: lot.locationId, type: 'RETURN', qtyDelta: ri.qty, reason: 'return → quarantine' } });
      } else if (d.disposition === 'WRITE_OFF' && lot) {
        await tx.movementLedger.create({ data: { lotId: lot.id, locationId: lot.locationId, type: 'WRITE_OFF', qtyDelta: 0, reason: 'return write-off' } });
      }
    }
    await tx.return.update({ where: { id }, data: { status: input.status, refundMethod: input.refundMethod, refundPiastres: input.refundEgp != null ? egpToPiastres(input.refundEgp) : null } });
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'return.process', entityType: 'Return', entityId: id, data: { status: input.status } });
}
