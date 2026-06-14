import { prisma } from '@/lib/prisma';
import { earnedPoints, pointsToPiastres } from '@/lib/loyalty';

/** Loyalty service (FR-PRC-04). Points earn when an order is delivered (revenue
 *  realized) and lifetime spend updates then too. Redemption is recorded at
 *  checkout. Double-credit is guarded by checking for an existing EARN txn. */

export async function creditOrderPoints(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { customer: { include: { tier: true } } } });
  if (!order?.customerId || !order.customer) return 0;
  const already = await prisma.loyaltyTransaction.findFirst({ where: { orderId, type: 'EARN' } });
  if (already) return 0;

  const rate = order.customer.tier?.earnRatePerEgp ?? 1;
  const pts = earnedPoints(order.subtotalPiastres, rate);
  if (pts <= 0) return 0;

  await prisma.$transaction([
    prisma.loyaltyTransaction.create({ data: { customerId: order.customerId, points: pts, type: 'EARN', orderId } }),
    prisma.customer.update({ where: { id: order.customerId }, data: { pointsBalance: { increment: pts }, lifetimeSpendPiastres: { increment: order.totalPiastres } } }),
  ]);
  return pts;
}

/** Redeem points at checkout; returns the EGP value (piastres) applied. */
export async function redeemPoints(customerId: string, points: number, orderId?: string): Promise<bigint> {
  if (points <= 0) return 0n;
  const value = pointsToPiastres(points);
  if (value <= 0n) return 0n;
  await prisma.$transaction([
    prisma.loyaltyTransaction.create({ data: { customerId, points: -points, type: 'REDEEM', orderId, note: 'order redemption' } }),
    prisma.customer.update({ where: { id: customerId }, data: { pointsBalance: { decrement: points } } }),
  ]);
  return value;
}

/** Award bonus points (e.g. for a review). */
export async function awardBonus(customerId: string, points: number, note: string): Promise<void> {
  if (points <= 0) return;
  await prisma.$transaction([
    prisma.loyaltyTransaction.create({ data: { customerId, points, type: 'BONUS', note } }),
    prisma.customer.update({ where: { id: customerId }, data: { pointsBalance: { increment: points } } }),
  ]);
}
