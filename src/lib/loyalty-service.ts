import { prisma } from '@/lib/prisma';
import { earnedPoints, pointsToPiastres } from '@/lib/loyalty';
import { getNumberSetting } from '@/lib/settings-service';

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

/**
 * Referral reward (FR-LOY referral rule). When a referred customer's order is
 * delivered, the referrer earns points = configured percent of the order's base
 * points (1 pt/EGP). The percent is firstYearPercent within the referee's first
 * year, else afterPercent (both admin-configurable settings). Idempotent per
 * order. Returns points awarded.
 */
export async function creditReferralReward(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: { include: { referredBy: true } } },
  });
  const referrer = order?.customer?.referredBy;
  if (!order?.customer || !referrer) return 0;
  const already = await prisma.loyaltyTransaction.findFirst({ where: { orderId, type: 'REFERRAL' } });
  if (already) return 0;

  const firstYear = Date.now() - order.customer.createdAt.getTime() < 365 * 86_400_000;
  const pct = await getNumberSetting(firstYear ? 'referral.firstYearPercent' : 'referral.afterPercent');
  const basePts = earnedPoints(order.subtotalPiastres, 1);
  const reward = Math.floor((pct / 100) * basePts);
  if (reward <= 0) return 0;

  await prisma.$transaction([
    prisma.loyaltyTransaction.create({ data: { customerId: referrer.id, points: reward, type: 'REFERRAL', orderId, note: `referral reward (${pct}%)` } }),
    prisma.customer.update({ where: { id: referrer.id }, data: { pointsBalance: { increment: reward } } }),
  ]);
  return reward;
}

/**
 * Reverse the loyalty + referral points an order earned (Cancelled / Refunded).
 * Idempotent: only reverses an EARN/REFERRAL that hasn't already been reversed
 * (guarded by a matching ADJUST note). Also rolls back lifetime spend. Returns
 * the total points clawed back.
 */
export async function reverseOrderPoints(orderId: string): Promise<number> {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return 0;
  let reversed = 0;

  const earn = await prisma.loyaltyTransaction.findFirst({ where: { orderId, type: 'EARN' } });
  if (earn && earn.customerId) {
    const already = await prisma.loyaltyTransaction.findFirst({ where: { orderId, type: 'ADJUST', note: 'reverse:order' } });
    // LOST-item clawbacks already debited part of this EARN — reverse only the
    // remainder, or the customer is debited more than was ever credited.
    const lostAdj = await prisma.loyaltyTransaction.aggregate({ _sum: { points: true }, where: { orderId, type: 'ADJUST', note: { in: ['lost item', 'restore lost item'] } } });
    const alreadyClawed = Math.max(0, -(lostAdj._sum.points ?? 0));
    const claw = Math.max(0, earn.points - alreadyClawed);
    if (!already && claw > 0) {
      await prisma.$transaction([
        prisma.loyaltyTransaction.create({ data: { customerId: earn.customerId, points: -claw, type: 'ADJUST', orderId, note: 'reverse:order' } }),
        prisma.customer.update({ where: { id: earn.customerId }, data: { pointsBalance: { decrement: claw }, lifetimeSpendPiastres: { decrement: order.totalPiastres } } }),
      ]);
      reversed += claw;
    }
  }

  const ref = await prisma.loyaltyTransaction.findFirst({ where: { orderId, type: 'REFERRAL' } });
  if (ref && ref.customerId) {
    const already = await prisma.loyaltyTransaction.findFirst({ where: { orderId, type: 'ADJUST', note: 'reverse:referral' } });
    if (!already && ref.points > 0) {
      await prisma.$transaction([
        prisma.loyaltyTransaction.create({ data: { customerId: ref.customerId, points: -ref.points, type: 'ADJUST', orderId, note: 'reverse:referral' } }),
        prisma.customer.update({ where: { id: ref.customerId }, data: { pointsBalance: { decrement: ref.points } } }),
      ]);
      reversed += ref.points;
    }
  }

  // Points the customer SPENT on this order come back too — the money refund
  // returns the already-discounted total, so without this the redeemed points
  // simply evaporate on a cancelled/refunded order.
  if (order.customerId) {
    const redeems = await prisma.loyaltyTransaction.aggregate({ _sum: { points: true }, where: { orderId, type: 'REDEEM' } });
    const spent = Math.max(0, -(redeems._sum.points ?? 0));
    if (spent > 0) {
      const already = await prisma.loyaltyTransaction.findFirst({ where: { orderId, type: 'ADJUST', note: 'reverse:redeem' } });
      if (!already) {
        await prisma.$transaction([
          prisma.loyaltyTransaction.create({ data: { customerId: order.customerId, points: spent, type: 'ADJUST', orderId, note: 'reverse:redeem' } }),
          prisma.customer.update({ where: { id: order.customerId }, data: { pointsBalance: { increment: spent } } }),
        ]);
      }
    }
  }
  return reversed;
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
