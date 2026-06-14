import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';

/**
 * Stocktake module (FR-STK-*). Monthly-named sessions per location. Phase 1
 * Forward counts in-stock lots; expected = live qty + active reservations
 * (Hold/Processing) so mid-count sales don't create phantom variances. Counts
 * post to live stock immediately and write the movement ledger. Uncounted lots
 * are flagged at close, never auto-zeroed.
 */

export function listStocktakes() {
  return prisma.stocktakeSession.findMany({ include: { location: true, _count: { select: { counts: true } } }, orderBy: { startedAt: 'desc' } });
}

export function getStocktake(id: string) {
  return prisma.stocktakeSession.findUnique({ where: { id }, include: { location: true, counts: true } });
}

export async function createStocktake(name: string, locationId: string) {
  const user = await requirePermission('stocktake.manage');
  const session = await prisma.stocktakeSession.create({ data: { name, locationId } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'stocktake.create', entityType: 'StocktakeSession', entityId: session.id });
  return session;
}

/** Phase 1 Forward: in-stock lots at the session's location with expected qty. */
export async function forwardList(sessionId: string) {
  const session = await prisma.stocktakeSession.findUnique({ where: { id: sessionId } });
  if (!session) return [];
  const lots = await prisma.lot.findMany({
    where: { locationId: session.locationId, qtyOnHand: { gt: 0 }, status: { in: ['LIVE', 'QUARANTINE'] } },
    include: { product: { select: { nameEn: true, sku: true } }, reservations: { select: { qty: true } } },
    orderBy: [{ product: { nameEn: 'asc' } }, { expiryDate: 'asc' }],
  });
  const counts = await prisma.stocktakeCount.findMany({ where: { sessionId }, select: { lotId: true, countedQty: true } });
  const countedBy = new Map(counts.map((c) => [c.lotId, c.countedQty]));
  return lots.map((l) => ({
    lot: l,
    expected: l.qtyOnHand + l.reservations.reduce((s, r) => s + r.qty, 0),
    counted: countedBy.get(l.id) ?? null,
  }));
}

/** Record a physical count; posts the lot to that quantity + writes the ledger. */
export async function recordCount(sessionId: string, lotId: string, countedQty: number, reason?: string) {
  const user = await requirePermission('stocktake.manage');
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) throw new Error('NOT_FOUND');
  const variance = countedQty - lot.qtyOnHand;

  const existing = await prisma.stocktakeCount.findFirst({ where: { sessionId, lotId } });
  const countData = {
    sessionId,
    productId: lot.productId,
    lotId,
    locationId: lot.locationId,
    expectedQty: lot.qtyOnHand,
    countedQty,
    varianceReason: reason,
    countedById: user.id,
    countedAt: new Date(),
  };
  if (existing) await prisma.stocktakeCount.update({ where: { id: existing.id }, data: countData });
  else await prisma.stocktakeCount.create({ data: countData });

  await prisma.lot.update({ where: { id: lotId }, data: { qtyOnHand: countedQty } });
  if (variance !== 0) {
    await prisma.movementLedger.create({ data: { lotId, locationId: lot.locationId, type: 'COUNT', qtyDelta: variance, reason: reason ?? 'stocktake' } });
  }
  return { variance };
}

/** Phase 2 Reverse: register a physical lot not currently in the system. */
export async function registerReverseLot(sessionId: string, input: { productId: string; expiryDate: string; qty: number }) {
  const user = await requirePermission('stocktake.manage');
  const session = await prisma.stocktakeSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('NOT_FOUND');
  const lot = await prisma.lot.create({
    data: { productId: input.productId, locationId: session.locationId, expiryDate: new Date(input.expiryDate), qtyOnHand: input.qty, status: 'LIVE' },
  });
  await prisma.stocktakeCount.create({
    data: { sessionId, productId: input.productId, lotId: lot.id, locationId: session.locationId, expectedQty: 0, countedQty: input.qty, countedById: user.id, countedAt: new Date() },
  });
  await prisma.movementLedger.create({ data: { lotId: lot.id, locationId: session.locationId, type: 'COUNT', qtyDelta: input.qty, reason: 'reverse stocktake' } });
  return lot;
}

export async function closeStocktake(sessionId: string) {
  const user = await requirePermission('stocktake.manage');
  const counts = await prisma.stocktakeCount.findMany({ where: { sessionId } });
  const session = await prisma.stocktakeSession.update({
    where: { id: sessionId },
    data: { status: 'CLOSED', closedAt: new Date(), snapshotJson: { countedLots: counts.length, closedAt: new Date().toISOString() } },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'stocktake.close', entityType: 'StocktakeSession', entityId: sessionId });
  return session;
}
