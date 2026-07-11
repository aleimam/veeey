import { prisma } from '@/lib/prisma';
import { requirePermission, getCurrentUser } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import type { Prisma } from '@/generated/prisma/client';

/**
 * Stocktake module (FR-STK-*), V4 rework. Counting RECORDS numbers only —
 * nothing touches live stock until a reviewer APPROVES the reconcile screen,
 * which applies every variance at the lot level (ledger COUNT rows + audit) and
 * closes the session. Closing without applying explicitly DISCARDS the counts.
 * Sessions can be full or cycle-scoped (category/brand), blind (Expected hidden
 * while counting), and assigned to a counter. Recurring schedules open sessions
 * automatically from a daily worker cron.
 */

export type StocktakeScope = { categoryId?: string | null; brandId?: string | null };

const scopeOf = (raw: unknown): StocktakeScope => {
  const r = (raw ?? {}) as Record<string, unknown>;
  return {
    categoryId: typeof r.categoryId === 'string' && r.categoryId ? r.categoryId : null,
    brandId: typeof r.brandId === 'string' && r.brandId ? r.brandId : null,
  };
};

// ---- Sessions ----------------------------------------------------------------

/** Sessions with attribution + variance/adjustment summaries for the list page. */
export async function listStocktakes() {
  const sessions = await prisma.stocktakeSession.findMany({
    include: { location: true, counts: { select: { countedQty: true, expectedQty: true } } },
    orderBy: { startedAt: 'desc' },
  });
  const userIds = [...new Set(sessions.flatMap((s) => [s.createdById, s.assignedToId, s.approvedById]).filter((v): v is string => !!v))];
  const users = userIds.length ? await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, email: true } }) : [];
  const nameBy = new Map(users.map((u) => [u.id, u.name || u.email || u.id]));

  return sessions.map((s) => {
    const counted = s.counts.filter((c) => c.countedQty != null);
    const variances = counted.filter((c) => (c.countedQty ?? 0) !== c.expectedQty);
    const adjustmentUnits = variances.reduce((sum, c) => sum + Math.abs((c.countedQty ?? 0) - c.expectedQty), 0);
    return {
      id: s.id,
      name: s.name,
      location: s.location,
      status: s.status,
      blind: s.blind,
      scope: scopeOf(s.scopeJson),
      startedAt: s.startedAt,
      closedAt: s.closedAt,
      appliedAt: s.appliedAt,
      createdBy: s.createdById ? nameBy.get(s.createdById) ?? s.createdById : null,
      assignedTo: s.assignedToId ? nameBy.get(s.assignedToId) ?? s.assignedToId : null,
      approvedBy: s.approvedById ? nameBy.get(s.approvedById) ?? s.approvedById : null,
      countedLots: counted.length,
      varianceLots: variances.length,
      adjustmentUnits,
    };
  });
}

export function getStocktake(id: string) {
  return prisma.stocktakeSession.findUnique({ where: { id }, include: { location: true } });
}

export async function createStocktake(input: {
  name: string;
  locationId: string;
  blind?: boolean;
  scope?: StocktakeScope;
  assignedToId?: string | null;
}) {
  const user = await requirePermission('stocktake.manage');
  const scope = scopeOf(input.scope);
  const session = await prisma.stocktakeSession.create({
    data: {
      name: input.name,
      locationId: input.locationId,
      blind: !!input.blind,
      scopeJson: (scope.categoryId || scope.brandId ? scope : undefined) as Prisma.InputJsonValue | undefined,
      assignedToId: input.assignedToId || null,
      createdById: user.id,
    },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'stocktake.create', entityType: 'StocktakeSession', entityId: session.id, data: { blind: !!input.blind, scope } });
  return session;
}

/** Delete a test/abandoned session. Applied sessions are kept (their ledger
 *  rows exist) unless force-deleted from the DB — the UI only offers this for
 *  never-applied sessions. Counts cascade. */
export async function deleteStocktake(sessionId: string) {
  const user = await requirePermission('stocktake.manage');
  const s = await prisma.stocktakeSession.findUniqueOrThrow({ where: { id: sessionId }, select: { appliedAt: true } });
  if (s.appliedAt) throw new Error('APPLIED_SESSION');
  await prisma.stocktakeSession.delete({ where: { id: sessionId } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'stocktake.delete', entityType: 'StocktakeSession', entityId: sessionId });
}

// ---- Count sheet ---------------------------------------------------------------

export type SheetRow = {
  lotId: string;
  productId: string;
  name: string;
  nameAr: string | null;
  sku: string;
  brand: string | null;
  categories: string[];
  condition: string;
  expiry: string | null; // ISO date or null
  expected: number;
  counted: number | null;
  reason: string | null;
};

/** In-stock lots at the session's location (scope-filtered) with expected qty +
 *  any recorded count. Expected = on-hand + active reservations so mid-count
 *  sales don't create phantom variances. */
export async function sheetRows(sessionId: string): Promise<SheetRow[]> {
  const session = await prisma.stocktakeSession.findUnique({ where: { id: sessionId } });
  if (!session) return [];
  const scope = scopeOf(session.scopeJson);
  const lots = await prisma.lot.findMany({
    where: {
      locationId: session.locationId,
      qtyOnHand: { gt: 0 },
      status: { in: ['LIVE', 'QUARANTINE'] },
      ...(scope.categoryId || scope.brandId
        ? { product: { ...(scope.brandId ? { brandId: scope.brandId } : {}), ...(scope.categoryId ? { categories: { some: { id: scope.categoryId } } } : {}) } }
        : {}),
    },
    include: {
      product: { select: { nameEn: true, nameAr: true, sku: true, brand: { select: { nameEn: true } }, categories: { select: { nameEn: true } } } },
      reservations: { select: { qty: true } },
    },
    orderBy: [{ product: { nameEn: 'asc' } }, { expiryDate: 'asc' }],
  });
  const counts = await prisma.stocktakeCount.findMany({ where: { sessionId }, select: { lotId: true, countedQty: true, varianceReason: true } });
  const byLot = new Map(counts.map((c) => [c.lotId, c]));
  return lots.map((l) => ({
    lotId: l.id,
    productId: l.productId,
    name: l.product.nameEn,
    nameAr: l.product.nameAr,
    sku: l.product.sku,
    brand: l.product.brand?.nameEn ?? null,
    categories: l.product.categories.map((c) => c.nameEn),
    condition: l.condition,
    expiry: l.expiryDate ? l.expiryDate.toISOString().slice(0, 10) : null,
    expected: l.qtyOnHand + l.reservations.reduce((s, r) => s + r.qty, 0),
    counted: byLot.get(l.id)?.countedQty ?? null,
    reason: byLot.get(l.id)?.varianceReason ?? null,
  }));
}

/** Record counts — STORE ONLY (V4 D18): live stock is untouched until the
 *  reconcile step is approved. Upserts one row per lot. */
export async function recordCounts(sessionId: string, entries: { lotId: string; countedQty: number; reason?: string | null }[]) {
  const user = await requirePermission('stocktake.manage');
  const session = await prisma.stocktakeSession.findUniqueOrThrow({ where: { id: sessionId }, select: { status: true } });
  if (session.status !== 'OPEN') throw new Error('NOT_OPEN');
  let saved = 0;
  for (const e of entries) {
    if (!Number.isFinite(e.countedQty) || e.countedQty < 0) continue;
    const lot = await prisma.lot.findUnique({ where: { id: e.lotId }, select: { productId: true, locationId: true, qtyOnHand: true } });
    if (!lot) continue;
    const data = {
      sessionId,
      productId: lot.productId,
      lotId: e.lotId,
      locationId: lot.locationId,
      expectedQty: lot.qtyOnHand,
      countedQty: Math.floor(e.countedQty),
      varianceReason: e.reason?.trim() || null,
      countedById: user.id,
      countedAt: new Date(),
    };
    const existing = await prisma.stocktakeCount.findFirst({ where: { sessionId, lotId: e.lotId }, select: { id: true } });
    if (existing) await prisma.stocktakeCount.update({ where: { id: existing.id }, data });
    else await prisma.stocktakeCount.create({ data });
    saved += 1;
  }
  return { saved };
}

/** Back-compat single-count entry (kept for the reverse-lot flow). */
export async function recordCount(sessionId: string, lotId: string, countedQty: number, reason?: string) {
  const r = await recordCounts(sessionId, [{ lotId, countedQty, reason }]);
  return { saved: r.saved };
}

/** Phase 2 Reverse: register a physical lot not currently in the system —
 *  created LIVE immediately (it exists on the shelf) + counted at its qty. */
export async function registerReverseLot(sessionId: string, input: { productId: string; expiryDate: string; qty: number }) {
  const user = await requirePermission('stocktake.manage');
  const session = await prisma.stocktakeSession.findUnique({ where: { id: sessionId } });
  if (!session) throw new Error('NOT_FOUND');
  const lot = await prisma.lot.create({
    data: { productId: input.productId, locationId: session.locationId, expiryDate: new Date(input.expiryDate), qtyOnHand: input.qty, status: 'LIVE' },
  });
  await prisma.stocktakeCount.create({
    data: { sessionId, productId: input.productId, lotId: lot.id, locationId: session.locationId, expectedQty: input.qty, countedQty: input.qty, countedById: user.id, countedAt: new Date() },
  });
  await prisma.movementLedger.create({ data: { lotId: lot.id, locationId: session.locationId, type: 'COUNT', qtyDelta: input.qty, reason: 'reverse stocktake' } });
  return lot;
}

// ---- Reconcile & apply ---------------------------------------------------------

export type ReconcileRow = {
  countId: string;
  lotId: string | null;
  name: string;
  sku: string;
  condition: string | null;
  expiry: string | null;
  expectedAtCount: number;
  currentQty: number | null;
  counted: number;
  variance: number; // counted − current live qty (what applying would change)
  reason: string | null;
  countedBy: string | null;
  countedAt: Date | null;
};

/** Everything recorded in the session, with LIVE current qty so the reviewer
 *  sees exactly what approval will change. */
export async function reconcileRows(sessionId: string): Promise<ReconcileRow[]> {
  const counts = await prisma.stocktakeCount.findMany({
    where: { sessionId, countedQty: { not: null } },
    include: {
      product: { select: { nameEn: true, sku: true } },
      lot: { select: { qtyOnHand: true, condition: true, expiryDate: true } },
      countedBy: { select: { name: true, email: true } },
    },
    orderBy: { countedAt: 'asc' },
  });
  return counts.map((c) => {
    const current = c.lot?.qtyOnHand ?? null;
    return {
      countId: c.id,
      lotId: c.lotId,
      name: c.product.nameEn,
      sku: c.product.sku,
      condition: c.lot?.condition ?? null,
      expiry: c.lot?.expiryDate ? c.lot.expiryDate.toISOString().slice(0, 10) : null,
      expectedAtCount: c.expectedQty,
      currentQty: current,
      counted: c.countedQty!,
      variance: current != null ? c.countedQty! - current : 0,
      reason: c.varianceReason,
      countedBy: c.countedBy?.name || c.countedBy?.email || null,
      countedAt: c.countedAt,
    };
  });
}

/** APPROVE: apply every counted lot to its counted qty (ledger COUNT rows for
 *  non-zero variances), stamp approver, close the session as applied. */
export async function applyStocktake(sessionId: string) {
  const user = await requirePermission('stocktake.manage');
  const session = await prisma.stocktakeSession.findUniqueOrThrow({ where: { id: sessionId } });
  if (session.status !== 'OPEN') throw new Error('NOT_OPEN');
  const rows = await reconcileRows(sessionId);

  let adjustedLots = 0;
  let adjustedUnits = 0;
  for (const r of rows) {
    if (!r.lotId || r.currentQty == null) continue;
    if (r.variance === 0) continue;
    await prisma.$transaction([
      prisma.lot.update({ where: { id: r.lotId }, data: { qtyOnHand: r.counted } }),
      prisma.movementLedger.create({ data: { lotId: r.lotId, locationId: session.locationId, type: 'COUNT', qtyDelta: r.variance, reason: r.reason ?? 'stocktake', refType: 'stocktake', refId: sessionId } }),
    ]);
    adjustedLots += 1;
    adjustedUnits += Math.abs(r.variance);
  }

  const closed = await prisma.stocktakeSession.update({
    where: { id: sessionId },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      appliedAt: new Date(),
      approvedById: user.id,
      snapshotJson: { countedLots: rows.length, adjustedLots, adjustedUnits, appliedAt: new Date().toISOString() },
    },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'stocktake.apply', entityType: 'StocktakeSession', entityId: sessionId, data: { countedLots: rows.length, adjustedLots, adjustedUnits } });
  return { closed, adjustedLots, adjustedUnits };
}

/** Close WITHOUT applying — recorded counts are kept for reference but no
 *  stock changes (explicit discard semantics, V4 D18). */
export async function closeStocktake(sessionId: string) {
  const user = await requirePermission('stocktake.manage');
  const counts = await prisma.stocktakeCount.count({ where: { sessionId, countedQty: { not: null } } });
  const session = await prisma.stocktakeSession.update({
    where: { id: sessionId },
    data: { status: 'CLOSED', closedAt: new Date(), snapshotJson: { countedLots: counts, discarded: true, closedAt: new Date().toISOString() } },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'stocktake.close_discard', entityType: 'StocktakeSession', entityId: sessionId, data: { countedLots: counts } });
  return session;
}

// ---- Cycle-count schedules (V4 D21) --------------------------------------------

export function listStocktakeSchedules() {
  return prisma.stocktakeSchedule.findMany({ include: { location: { select: { name: true } } }, orderBy: { nextAt: 'asc' } });
}

export async function saveStocktakeSchedule(input: {
  name: string;
  locationId: string;
  intervalDays: number;
  blind?: boolean;
  scope?: StocktakeScope;
  assignedToId?: string | null;
}) {
  const user = await requirePermission('stocktake.manage');
  const scope = scopeOf(input.scope);
  const intervalDays = Math.max(1, Math.floor(input.intervalDays));
  const schedule = await prisma.stocktakeSchedule.create({
    data: {
      name: input.name,
      locationId: input.locationId,
      intervalDays,
      nextAt: new Date(Date.now() + intervalDays * 86_400_000),
      blind: !!input.blind,
      scopeJson: (scope.categoryId || scope.brandId ? scope : undefined) as Prisma.InputJsonValue | undefined,
      assignedToId: input.assignedToId || null,
    },
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'stocktake.schedule.create', entityType: 'StocktakeSchedule', entityId: schedule.id });
  return schedule;
}

export async function setStocktakeScheduleActive(id: string, active: boolean) {
  const user = await requirePermission('stocktake.manage');
  await prisma.stocktakeSchedule.update({ where: { id }, data: { active } });
  await audit({ actorType: 'USER', actorId: user.id, action: active ? 'stocktake.schedule.enable' : 'stocktake.schedule.disable', entityType: 'StocktakeSchedule', entityId: id });
}

export async function deleteStocktakeSchedule(id: string) {
  const user = await requirePermission('stocktake.manage');
  await prisma.stocktakeSchedule.delete({ where: { id } });
  await audit({ actorType: 'USER', actorId: user.id, action: 'stocktake.schedule.delete', entityType: 'StocktakeSchedule', entityId: id });
}

/** Worker cron: open a session for each due schedule and advance nextAt.
 *  System context — no session user. */
export async function runDueStocktakeSchedules(): Promise<{ opened: number }> {
  const due = await prisma.stocktakeSchedule.findMany({ where: { active: true, nextAt: { lte: new Date() } } });
  let opened = 0;
  for (const s of due) {
    const stamp = new Date().toISOString().slice(0, 10);
    await prisma.stocktakeSession.create({
      data: {
        name: `${s.name} — ${stamp}`,
        locationId: s.locationId,
        blind: s.blind,
        scopeJson: s.scopeJson ?? undefined,
        assignedToId: s.assignedToId,
      },
    });
    await prisma.stocktakeSchedule.update({
      where: { id: s.id },
      data: { lastRunAt: new Date(), nextAt: new Date(Date.now() + s.intervalDays * 86_400_000) },
    });
    opened += 1;
  }
  if (opened > 0) await audit({ actorType: 'SYSTEM', action: 'stocktake.schedule.run', data: { opened } });
  return { opened };
}

/** Staff options for the "assigned counter" select (department or role holders). */
export async function counterOptions(): Promise<{ id: string; label: string }[]> {
  const me = await getCurrentUser();
  if (!me) return [];
  const { staffWhere } = await import('@/lib/department-service');
  const users = await prisma.user.findMany({ where: staffWhere, select: { id: true, name: true, email: true }, orderBy: { name: 'asc' } });
  return users.map((u) => ({ id: u.id, label: u.name || u.email || u.id }));
}
