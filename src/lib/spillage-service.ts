import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { validateSpillage, canVoidSpillage, lossValuePiastres, SEED_SPILLAGE_REASONS } from '@/lib/spillage-logic';

/**
 * Spillage / damage service (Phase-2). Moves lot units into a damage state:
 *  - SELLABLE reason  → units transfer into a discounted variant lot (buy-box).
 *  - WRITE-OFF reason → units are deducted and lost (recorded with a cost snapshot).
 * Every move is atomic, RBAC-gated, audited, and mirrored in MovementLedger; the
 * SpillageEntry ledger drives the loss reports and the void/undo.
 */

// ── Reason list (admin-editable) ────────────────────────────────────────────

/** All reasons in display order, seeding the defaults on first access. */
export async function listSpillageReasons() {
  const rows = await prisma.spillageReason.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
  if (rows.length) return rows;
  await prisma.spillageReason.createMany({ data: SEED_SPILLAGE_REASONS });
  return prisma.spillageReason.findMany({ orderBy: [{ sortOrder: 'asc' }, { code: 'asc' }] });
}

export async function saveSpillageReason(input: {
  id?: string; code: string; labelEn: string; labelAr?: string | null; sellable: boolean; active: boolean; sortOrder?: number;
}) {
  const actor = await requirePermission('inventory.manage');
  const code = input.code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
  if (!code || !input.labelEn.trim()) throw new Error('code and English label are required');
  const data = { code, labelEn: input.labelEn.trim(), labelAr: input.labelAr?.trim() || null, sellable: input.sellable, active: input.active, sortOrder: input.sortOrder ?? 0 };
  const row = input.id
    ? await prisma.spillageReason.update({ where: { id: input.id }, data })
    : await prisma.spillageReason.create({ data });
  await audit({ actorType: 'USER', actorId: actor.id, action: 'spillage.reason_save', entityType: 'SpillageReason', entityId: row.id, data: { code } });
  return row;
}

export async function deleteSpillageReason(id: string) {
  const actor = await requirePermission('inventory.manage');
  const r = await prisma.spillageReason.findUniqueOrThrow({ where: { id } });
  if (r.isSystem) throw new Error('System reasons cannot be deleted.');
  // Never hard-delete a reason that has history — deactivate it so old entries
  // keep resolving their label in reports.
  const used = await prisma.spillageEntry.count({ where: { reasonCode: r.code } });
  if (used > 0) {
    await prisma.spillageReason.update({ where: { id }, data: { active: false } });
  } else {
    await prisma.spillageReason.delete({ where: { id } });
  }
  await audit({ actorType: 'USER', actorId: actor.id, action: 'spillage.reason_delete', entityType: 'SpillageReason', entityId: id, data: { code: r.code, deactivatedOnly: used > 0 } });
}

// ── Record a spillage ───────────────────────────────────────────────────────

/**
 * Move `qty` units of `lotId` into the damage state `reasonCode`. Returns the
 * created entry id. Atomic: the source decrement, the variant/write-off move,
 * the MovementLedger rows and the SpillageEntry all commit together — or none.
 */
export async function recordSpillage(input: {
  lotId: string; reasonCode: string; qty: number; variantPricePiastres?: number | null; note?: string | null;
}, actorIdOverride?: string | null): Promise<string> {
  // actorIdOverride is passed by the expiry sweep (system, no session). Admin
  // callers must hold inventory.manage.
  const actorId = actorIdOverride !== undefined ? actorIdOverride : (await requirePermission('inventory.manage')).id;

  return prisma.$transaction(async (tx) => {
    const lot = await tx.lot.findUniqueOrThrow({ where: { id: input.lotId } });
    const reason = await tx.spillageReason.findUniqueOrThrow({ where: { code: input.reasonCode } });

    const v = validateSpillage({
      qty: input.qty, lotQtyOnHand: lot.qtyOnHand, reasonActive: reason.active,
      reasonSellable: reason.sellable, variantPricePiastres: input.variantPricePiastres ?? null,
    });
    if (!v.ok) throw new Error(v.error);

    // Claim the units off the source lot atomically (guards against a racing
    // sale/spillage draining the same stock).
    const claimed = await tx.lot.updateMany({ where: { id: lot.id, qtyOnHand: { gte: input.qty } }, data: { qtyOnHand: { decrement: input.qty } } });
    if (claimed.count !== 1) throw new Error('qty_exceeds_stock');

    let toLotId: string | null = null;
    if (reason.sellable) {
      // Units become a sellable variant: a LIVE lot for the same product+expiry+
      // location, condition = the reason code, priced at the entered discount.
      // Reuse a matching variant lot if one already exists at that price.
      const price = BigInt(input.variantPricePiastres!);
      const existing = await tx.lot.findFirst({ where: { productId: lot.productId, locationId: lot.locationId, expiryDate: lot.expiryDate, condition: reason.code, status: 'LIVE', priceOverridePiastres: price }, select: { id: true } });
      toLotId = existing?.id ?? (await tx.lot.create({ data: { productId: lot.productId, locationId: lot.locationId, expiryDate: lot.expiryDate, condition: reason.code, priceOverridePiastres: price, costPiastres: lot.costPiastres, qtyOnHand: 0, status: 'LIVE' } })).id;
      await tx.lot.update({ where: { id: toLotId }, data: { qtyOnHand: { increment: input.qty } } });
      await tx.movementLedger.create({ data: { lotId: lot.id, locationId: lot.locationId, type: 'TRANSFER', qtyDelta: -input.qty, reason: `spillage → ${reason.code}`, refType: 'spillage' } });
      await tx.movementLedger.create({ data: { lotId: toLotId, locationId: lot.locationId, type: 'TRANSFER', qtyDelta: input.qty, reason: `spillage ← ${lot.condition}`, refType: 'spillage' } });
    } else {
      // Write-off: the units are gone.
      await tx.movementLedger.create({ data: { lotId: lot.id, locationId: lot.locationId, type: 'WRITE_OFF', qtyDelta: -input.qty, reason: `spillage: ${reason.code}`, refType: 'spillage' } });
    }

    const entry = await tx.spillageEntry.create({
      data: {
        lotId: lot.id, productId: lot.productId, reasonCode: reason.code, sellable: reason.sellable,
        qty: input.qty, toLotId, unitCostPiastres: lot.costPiastres, actorId, note: input.note?.trim() || null,
      },
    });
    await audit({ actorType: actorId ? 'USER' : 'SYSTEM', actorId, action: 'spillage.record', entityType: 'SpillageEntry', entityId: entry.id, data: { reason: reason.code, qty: input.qty, sellable: reason.sellable } });
    return entry.id;
  });
}

// ── Void (undo a mistaken entry) ────────────────────────────────────────────

/** Reverse a spillage entry: restore the units to the source lot and mark the
 *  entry voided (kept in the audit trail, excluded from reports). Only the
 *  latest un-voided entry for the lot can be voided. */
export async function voidSpillage(entryId: string): Promise<void> {
  const actor = await requirePermission('inventory.manage');
  await prisma.$transaction(async (tx) => {
    const entry = await tx.spillageEntry.findUniqueOrThrow({ where: { id: entryId } });
    const latest = await tx.spillageEntry.findFirst({ where: { lotId: entry.lotId, voidedAt: null }, orderBy: { createdAt: 'desc' }, select: { id: true } });
    if (!canVoidSpillage(entry, latest?.id ?? null)) throw new Error('only_latest_can_void');

    if (entry.sellable && entry.toLotId) {
      // Pull the units back out of the variant lot (never below zero).
      const variant = await tx.lot.findUnique({ where: { id: entry.toLotId }, select: { qtyOnHand: true } });
      const take = Math.min(entry.qty, variant?.qtyOnHand ?? 0);
      if (take > 0) await tx.lot.update({ where: { id: entry.toLotId }, data: { qtyOnHand: { decrement: take } } });
      await tx.movementLedger.create({ data: { lotId: entry.toLotId, locationId: (await tx.lot.findUniqueOrThrow({ where: { id: entry.toLotId }, select: { locationId: true } })).locationId, type: 'TRANSFER', qtyDelta: -take, reason: 'spillage void', refType: 'spillage_void' } });
    }
    const src = await tx.lot.findUniqueOrThrow({ where: { id: entry.lotId }, select: { locationId: true } });
    await tx.lot.update({ where: { id: entry.lotId }, data: { qtyOnHand: { increment: entry.qty } } });
    await tx.movementLedger.create({ data: { lotId: entry.lotId, locationId: src.locationId, type: entry.sellable ? 'TRANSFER' : 'ADJUST', qtyDelta: entry.qty, reason: 'spillage void', refType: 'spillage_void' } });
    await tx.spillageEntry.update({ where: { id: entryId }, data: { voidedAt: new Date(), voidedById: actor.id } });
  });
  await audit({ actorType: 'USER', actorId: actor.id, action: 'spillage.void', entityType: 'SpillageEntry', entityId: entryId });
}

// ── Reports ─────────────────────────────────────────────────────────────────

export type SpillageReportRow = { reasonCode: string; sellable: boolean; units: number; valuePiastres: bigint | null };

/** Loss summary over a period, grouped by reason. Units are always exact; value
 *  is null unless every contributing lot carried a cost (owner: units now). */
export async function spillageReport(opts: { from?: Date; to?: Date } = {}): Promise<{ rows: SpillageReportRow[]; totalUnits: number; totalValue: bigint | null }> {
  await requirePermission('inventory.manage');
  const entries = await prisma.spillageEntry.findMany({
    where: { voidedAt: null, ...(opts.from || opts.to ? { createdAt: { ...(opts.from ? { gte: opts.from } : {}), ...(opts.to ? { lt: opts.to } : {}) } } : {}) },
    select: { reasonCode: true, sellable: true, qty: true, unitCostPiastres: true },
  });
  const byReason = new Map<string, SpillageReportRow>();
  let totalUnits = 0;
  let totalValue: bigint | null = 0n;
  let anyMissingCost = false;
  for (const e of entries) {
    const row = byReason.get(e.reasonCode) ?? { reasonCode: e.reasonCode, sellable: e.sellable, units: 0, valuePiastres: 0n };
    row.units += e.qty;
    const v = lossValuePiastres(e.qty, e.unitCostPiastres);
    if (v == null) { anyMissingCost = true; row.valuePiastres = null; }
    else if (row.valuePiastres != null) row.valuePiastres += v;
    byReason.set(e.reasonCode, row);
    totalUnits += e.qty;
    if (v == null) anyMissingCost = true; else if (totalValue != null) totalValue += v;
  }
  // If any lot lacked a cost, the value totals are incomplete — report null so
  // the UI shows "—" rather than a misleadingly-precise partial figure.
  if (anyMissingCost) totalValue = null;
  return { rows: [...byReason.values()].sort((a, b) => b.units - a.units), totalUnits, totalValue };
}

/** Find in-stock lots for the record form, by product SKU / name. */
export async function searchLotsForSpillage(q: string, limit = 20) {
  await requirePermission('inventory.manage');
  const term = q.trim();
  if (!term) return [];
  return prisma.lot.findMany({
    where: {
      status: 'LIVE', qtyOnHand: { gt: 0 },
      product: { OR: [{ sku: { contains: term, mode: 'insensitive' } }, { nameEn: { contains: term, mode: 'insensitive' } }, { nameAr: { contains: term, mode: 'insensitive' } }] },
    },
    orderBy: [{ product: { nameEn: 'asc' } }, { expiryDate: 'asc' }],
    take: limit,
    select: { id: true, qtyOnHand: true, condition: true, expiryDate: true, priceOverridePiastres: true, product: { select: { nameEn: true, nameAr: true, sku: true, basePricePiastres: true } } },
  });
}

/** Recent non-voided entries for the history table (with product name + reason). */
export async function recentSpillage(limit = 100) {
  await requirePermission('inventory.manage');
  const [entries, reasons] = await Promise.all([
    prisma.spillageEntry.findMany({
      orderBy: { createdAt: 'desc' }, take: limit,
      include: { product: { select: { nameEn: true, nameAr: true, sku: true } } },
    }),
    listSpillageReasons(),
  ]);
  const labelOf = new Map(reasons.map((r) => [r.code, r]));
  // The latest un-voided entry per lot is the only one that may be voided.
  const latestByLot = new Map<string, string>();
  for (const e of entries) if (!e.voidedAt && !latestByLot.has(e.lotId)) latestByLot.set(e.lotId, e.id);
  return entries.map((e) => ({ ...e, reason: labelOf.get(e.reasonCode) ?? null, canVoid: !e.voidedAt && latestByLot.get(e.lotId) === e.id }));
}
