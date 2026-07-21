import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';
import type { Prisma } from '@/generated/prisma/client';

/** Returns & refunds (FR-RET-*). Returned stock goes to QUARANTINE for pharmacist
 *  review (re-shelf to the correct lot or write off — never auto-resell). */

export type ReturnReasonRef = { reasonCode: string; reasonId?: string | null; reasonNote?: string | null };

export async function requestReturn(orderId: string, customerId: string | null, reason: ReturnReasonRef, items: { orderItemId: string; qty: number }[]) {
  const ret = await prisma.return.create({
    data: {
      orderId,
      customerId,
      reasonCode: reason.reasonCode,
      reasonId: reason.reasonId ?? null,
      reasonNote: reason.reasonNote ?? null,
      status: 'REQUESTED',
      items: { create: items.map((i) => ({ orderItemId: i.orderItemId, qty: i.qty, disposition: 'PENDING' })) },
    },
  });
  await audit({ actorType: customerId ? 'CUSTOMER' : 'USER', actorId: customerId, action: 'return.request', entityType: 'Return', entityId: ret.id });
  return ret;
}

export const listReturns = ({ status, q, reasonId }: { status?: string; q?: string; reasonId?: string } = {}) =>
  prisma.return.findMany({
    where: {
      ...(status ? { status: status as Prisma.ReturnWhereInput['status'] } : {}),
      ...(reasonId ? { reasonId } : {}),
      // Search matches the order number or the customer (email / name).
      ...(q
        ? { OR: [
            { order: { number: { contains: q, mode: 'insensitive' } } },
            { customer: { user: { email: { contains: q, mode: 'insensitive' } } } },
            { customer: { firstName: { contains: q, mode: 'insensitive' } } },
            { customer: { lastName: { contains: q, mode: 'insensitive' } } },
          ] }
        : {}),
    },
    include: {
      order: { select: { id: true, number: true } },
      customer: { select: { firstName: true, lastName: true, user: { select: { email: true } } } },
      reason: { select: { labelEn: true, labelAr: true } },
      items: true,
    },
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
        // Straight back to a SELLABLE (LIVE) lot — choosing RESTOCK on a return
        // IS the pharmacist's passed-inspection sign-off (owner decision B-i);
        // the units are re-shelved into the same product+expiry+condition, in a
        // LIVE lot reused if one exists, matching the order-cancel restock path.
        const live = await tx.lot.findFirst({ where: { productId: ri.orderItem.productId, locationId: lot.locationId, expiryDate: lot.expiryDate, condition: lot.condition, status: 'LIVE' }, select: { id: true } });
        const targetId = live?.id ?? (await tx.lot.create({ data: { productId: ri.orderItem.productId, locationId: lot.locationId, expiryDate: lot.expiryDate, condition: lot.condition, qtyOnHand: 0, status: 'LIVE' } })).id;
        await tx.lot.update({ where: { id: targetId }, data: { qtyOnHand: { increment: ri.qty } } });
        await tx.movementLedger.create({ data: { lotId: targetId, locationId: lot.locationId, type: 'RETURN', qtyDelta: ri.qty, reason: 'return → sellable' } });
      } else if (d.disposition === 'WRITE_OFF' && lot) {
        await tx.movementLedger.create({ data: { lotId: lot.id, locationId: lot.locationId, type: 'WRITE_OFF', qtyDelta: 0, reason: 'return write-off' } });
      }
    }
    await tx.return.update({ where: { id }, data: { status: input.status, refundMethod: input.refundMethod, refundPiastres: input.refundEgp != null ? egpToPiastres(input.refundEgp) : null } });
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'return.process', entityType: 'Return', entityId: id, data: { status: input.status } });
}
