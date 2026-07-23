import { prisma } from '@/lib/prisma';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Reverse-logistics hub queries — powers the four Returns tabs (owner batch
 * 2026-07-23). The hub spans TWO data sources: cancelled ORDERS whose goods
 * shipped and haven't come back (an order query, tab "Cancelled"), and customer
 * RETURN records (tabs "Returned" + "Needs refund"). Analytics summarises both.
 *
 * All queries are read-only; mutations still go through return-service /
 * order-service. Lists are capped so a huge history can't blow up the page —
 * the page shows a "showing first N" note when the cap is hit.
 */

export const HUB_CAP = 200;

// A return is physically back once it reaches quarantine or is dispositioned.
const RECEIVED: Prisma.ReturnWhereInput['status'] = { in: ['QUARANTINE', 'RESTOCKED', 'WRITTEN_OFF'] };
// The order was actually paid (fully or a deposit) — so a refund can be owed.
const PAID_STATES: Prisma.OrderWhereInput['paymentState'] = { in: ['PAID', 'DEPOSIT_PAID', 'PARTIALLY_REFUNDED'] };

export type ReturnsAnalytics = Awaited<ReturnType<typeof returnsAnalytics>>;

export async function returnsAnalytics() {
  const since = new Date();
  since.setDate(since.getDate() - 90);
  const [byStatus, refundAgg, totalReturns, topReasons, recentReturns, recentOrders, cancelledOpen, needsRefundCount] = await Promise.all([
    prisma.return.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.return.aggregate({ where: { refundPiastres: { not: null } }, _sum: { refundPiastres: true }, _count: { _all: true } }),
    prisma.return.count(),
    prisma.return.groupBy({ by: ['reasonCode'], _count: { _all: true }, orderBy: { _count: { reasonCode: 'desc' } }, take: 6 }),
    prisma.return.count({ where: { createdAt: { gte: since } } }),
    prisma.order.count({ where: { placedAt: { gte: since } } }),
    cancelledAwaitingReturnCount(),
    refundQueueNeedsCount(),
  ]);
  const statusCounts: Record<string, number> = {};
  for (const s of byStatus) statusCounts[s.status] = s._count._all;
  return {
    totalReturns,
    statusCounts,
    refundSum: refundAgg._sum.refundPiastres ?? 0n,
    refundCount: refundAgg._count._all,
    topReasons: topReasons.map((r) => ({ reason: r.reasonCode, count: r._count._all })),
    recentReturns,
    recentOrders,
    ratePct: recentOrders > 0 ? Math.round((recentReturns / recentOrders) * 1000) / 10 : 0,
    cancelledOpen,
    needsRefund: needsRefundCount,
  };
}

const CUSTOMER_SELECT = { firstName: true, lastName: true, user: { select: { email: true } } } as const;

/** Tab "Cancelled": orders that shipped (courier/AWB assigned) then got cancelled,
 *  with no return yet received — the goods are still out and need retrieving. */
export function cancelledAwaitingReturn() {
  return prisma.order.findMany({
    where: cancelledAwaitingWhere(),
    select: {
      id: true, number: true, totalPiastres: true, paymentState: true, courier: true, trackingNumber: true,
      updatedAt: true, placedAt: true, guestEmail: true, customer: { select: CUSTOMER_SELECT },
    },
    orderBy: { updatedAt: 'desc' },
    take: HUB_CAP,
  });
}
const cancelledAwaitingReturnCount = () => prisma.order.count({ where: cancelledAwaitingWhere() });
function cancelledAwaitingWhere(): Prisma.OrderWhereInput {
  return {
    status: 'CANCELLED',
    OR: [{ courier: { not: null } }, { trackingNumber: { not: null } }],
    returns: { none: { status: { in: ['RESTOCKED', 'WRITTEN_OFF'] } } },
  };
}

/** Tab "Needs refund": customer paid, the return is received/approved, and no
 *  refund has been recorded yet. Plus the already-refunded history for the record. */
export async function refundQueue() {
  const [needsRefund, refunded] = await Promise.all([
    prisma.return.findMany({
      where: refundNeedsWhere(),
      include: { order: { select: { id: true, number: true, totalPiastres: true, paymentState: true } }, customer: { select: CUSTOMER_SELECT }, reason: { select: { labelEn: true, labelAr: true } } },
      orderBy: { createdAt: 'desc' },
      take: HUB_CAP,
    }),
    prisma.return.findMany({
      where: { OR: [{ status: 'REFUNDED' }, { refundPiastres: { not: null } }] },
      include: { order: { select: { id: true, number: true } }, customer: { select: CUSTOMER_SELECT }, reason: { select: { labelEn: true, labelAr: true } } },
      orderBy: { createdAt: 'desc' },
      take: HUB_CAP,
    }),
  ]);
  return { needsRefund, refunded };
}
const refundQueueNeedsCount = () => prisma.return.count({ where: refundNeedsWhere() });

/** Cheap counts for the tab nav badges (the two action-required tabs). */
export async function hubCounts() {
  const [cancelled, needsRefund] = await Promise.all([cancelledAwaitingReturnCount(), refundQueueNeedsCount()]);
  return { cancelled, needsRefund };
}
function refundNeedsWhere(): Prisma.ReturnWhereInput {
  return {
    refundPiastres: null,
    status: RECEIVED,
    order: { paymentState: PAID_STATES },
  };
}
