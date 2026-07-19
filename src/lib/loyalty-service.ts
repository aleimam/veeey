import { prisma } from '@/lib/prisma';
import { earnedPoints, pointsToPiastres } from '@/lib/loyalty';
import { getNumberSetting } from '@/lib/settings-service';
import { pickTierId, standingChanged, manualTierActive } from '@/lib/loyalty-standing';
import { audit } from '@/lib/audit';

/** Loyalty service (FR-PRC-04). Points earn when an order is delivered (revenue
 *  realized) and lifetime spend updates then too. Redemption is recorded at
 *  checkout. Double-credit is guarded by checking for an existing EARN txn. */

/**
 * Recompute loyalty STANDING — lifetime spend (Σ DELIVERED order totals) + tier
 * (highest threshold met) — for one customer or the whole base (V5 F29).
 * Canonical + idempotent: covers orders that never passed transitionOrder
 * (WooCommerce-imported/synced ones), which is why 16k customers sat at
 * "0 pts · 0 EGP · base tier". Deliberately does NOT touch pointsBalance —
 * per owner decision, points are not minted retroactively; they accrue from
 * now on via creditOrderPoints.
 *
 * Tier basis: Setting `loyalty.tierWindowDays` (admin-editable). 0 (default) =
 * lifetime spend decides the tier (unchanged behavior); N > 0 = only DELIVERED
 * spend in the last N days counts toward the tier. `lifetimeSpendPiastres`
 * ALWAYS stays true lifetime — the window affects tier pick only.
 */
export async function recomputeLoyaltyStanding(customerId?: string): Promise<{ scanned: number; updated: number }> {
  const tiers = (await prisma.tier.findMany({ select: { id: true, rank: true, minSpendPiastres: true } }))
    .map((t) => ({ ...t, minSpendPiastres: BigInt(t.minSpendPiastres) }));
  const windowDays = Math.max(0, Math.round(await getNumberSetting('loyalty.tierWindowDays')));

  const spendRows = await prisma.order.groupBy({
    by: ['customerId'],
    where: { status: 'DELIVERED', customerId: customerId ?? { not: null } },
    _sum: { totalPiastres: true },
  });
  const spendBy = new Map(spendRows.map((r) => [r.customerId as string, BigInt(r._sum.totalPiastres ?? 0n)]));

  // Windowed spend (tier basis) — same rows bounded to the last N days.
  let tierSpendBy = spendBy;
  if (windowDays > 0) {
    const since = new Date(Date.now() - windowDays * 86_400_000);
    const windowRows = await prisma.order.groupBy({
      by: ['customerId'],
      where: { status: 'DELIVERED', customerId: customerId ?? { not: null }, placedAt: { gte: since } },
      _sum: { totalPiastres: true },
    });
    tierSpendBy = new Map(windowRows.map((r) => [r.customerId as string, BigInt(r._sum.totalPiastres ?? 0n)]));
  }

  let scanned = 0;
  let updated = 0;
  const BATCH = 1000;
  let cursor: string | undefined;
  for (;;) {
    const customers = await prisma.customer.findMany({
      where: customerId ? { id: customerId } : {},
      select: { id: true, lifetimeSpendPiastres: true, tierId: true, tierManual: true, tierManualUntil: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (customers.length === 0) break;
    scanned += customers.length;

    const now = new Date();
    const writes = customers
      .map((c) => {
        const spend = spendBy.get(c.id) ?? 0n;
        // Manual/paid tier lock: spend keeps updating, the tier does not. An
        // EXPIRED lock is cleared here so auto-tiering resumes.
        const locked = manualTierActive(c.tierManual, c.tierManualUntil, now);
        const expiredLock = c.tierManual && !locked;
        const tierId = locked ? c.tierId : pickTierId(tiers, tierSpendBy.get(c.id) ?? 0n);
        return standingChanged(c, { spendPiastres: spend, tierId }) || expiredLock
          ? { id: c.id, spend, tierId, clearLock: expiredLock }
          : null;
      })
      .filter((w): w is NonNullable<typeof w> => w !== null);

    for (let i = 0; i < writes.length; i += 50) {
      await Promise.all(
        writes.slice(i, i + 50).map((w) =>
          prisma.customer.update({
            where: { id: w.id },
            data: { lifetimeSpendPiastres: w.spend, tierId: w.tierId, ...(w.clearLock ? { tierManual: false, tierManualUntil: null } : {}) },
          }),
        ),
      );
    }
    updated += writes.length;

    cursor = customers[customers.length - 1].id;
    if (customers.length < BATCH || customerId) break;
  }

  if (!customerId && updated > 0) {
    await audit({ actorType: 'SYSTEM', action: 'loyalty.standing.recompute', entityType: 'Customer', data: { scanned, updated } });
  }
  return { scanned, updated };
}

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

/** Staff manual points adjustment — signed (positive = add, negative = deduct).
 *  Never lets the balance go negative. Recorded as an ADJUST ledger entry. */
export async function adjustCustomerPoints(customerId: string, delta: number, note: string, actorId?: string): Promise<{ balance: number }> {
  if (!Number.isInteger(delta) || delta === 0) throw new Error('BAD_AMOUNT');
  const c = await prisma.customer.findUniqueOrThrow({ where: { id: customerId }, select: { pointsBalance: true } });
  if (delta < 0 && c.pointsBalance + delta < 0) throw new Error('INSUFFICIENT');
  await prisma.$transaction([
    prisma.loyaltyTransaction.create({ data: { customerId, points: delta, type: 'ADJUST', note: note.trim() || (delta > 0 ? 'manual add' : 'manual deduct') } }),
    prisma.customer.update({ where: { id: customerId }, data: { pointsBalance: { increment: delta } } }),
  ]);
  await audit({ actorType: 'USER', actorId, action: 'loyalty.adjust', entityType: 'Customer', entityId: customerId, data: { delta, note } });
  return { balance: c.pointsBalance + delta };
}

/** How many DELIVERED orders have never earned points (for the backfill button). */
export function uncreditedOrderCount(customerId: string): Promise<number> {
  return prisma.order.count({ where: { customerId, status: 'DELIVERED', loyaltyTxns: { none: { type: 'EARN' } } } });
}

/**
 * Retroactively credit points for a customer's DELIVERED orders that never
 * earned any (points ONLY — lifetime spend stays owned by recomputeLoyalty
 * Standing). Idempotent per order (an EARN txn per order blocks re-credit).
 */
export async function backfillCustomerOrderPoints(customerId: string, actorId?: string): Promise<{ orders: number; points: number }> {
  const customer = await prisma.customer.findUnique({ where: { id: customerId }, include: { tier: true } });
  if (!customer) return { orders: 0, points: 0 };
  const rate = customer.tier?.earnRatePerEgp ?? 1;
  const orders = await prisma.order.findMany({ where: { customerId, status: 'DELIVERED', loyaltyTxns: { none: { type: 'EARN' } } }, select: { id: true, subtotalPiastres: true } });
  let points = 0, count = 0;
  for (const o of orders) {
    const pts = earnedPoints(o.subtotalPiastres, rate);
    if (pts <= 0) continue;
    await prisma.$transaction([
      prisma.loyaltyTransaction.create({ data: { customerId, points: pts, type: 'EARN', orderId: o.id, note: 'retroactive' } }),
      prisma.customer.update({ where: { id: customerId }, data: { pointsBalance: { increment: pts } } }),
    ]);
    points += pts; count++;
  }
  if (count) await audit({ actorType: 'USER', actorId, action: 'loyalty.backfill.customer', entityType: 'Customer', entityId: customerId, data: { orders: count, points } });
  return { orders: count, points };
}

/** Global retroactive backfill across every customer (worker job). */
export async function backfillAllOrderPoints(): Promise<{ customers: number; orders: number; points: number }> {
  const customerIds = await prisma.order.findMany({
    where: { status: 'DELIVERED', customerId: { not: null }, loyaltyTxns: { none: { type: 'EARN' } } },
    distinct: ['customerId'], select: { customerId: true }, take: 100_000,
  });
  let customers = 0, orders = 0, points = 0;
  for (const { customerId } of customerIds) {
    if (!customerId) continue;
    const r = await backfillCustomerOrderPoints(customerId);
    if (r.orders) { customers++; orders += r.orders; points += r.points; }
  }
  return { customers, orders, points };
}

/** Recent loyalty ledger entries for the admin profile. */
export function listLoyaltyTransactions(customerId: string, take = 12) {
  return prisma.loyaltyTransaction.findMany({ where: { customerId }, orderBy: { createdAt: 'desc' }, take, include: { order: { select: { number: true } } } });
}
