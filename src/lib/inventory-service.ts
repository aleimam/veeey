import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';
import { availableQty, daysToExpiry } from '@/lib/inventory';
import { LOT_CONDITIONS } from '@/lib/lot-condition';
import { suggestDiscountPct, discountedPiastres } from '@/lib/suggestion';

/** Inventory service (FR-INV-*). Lots are product × expiry × location. Every
 *  quantity change is recorded in the MovementLedger for reconstruction. */

const HOLD_MINUTES_DEFAULT = 30; // configurable later

export const lotInputSchema = z.object({
  productId: z.string().min(1),
  locationId: z.string().min(1),
  expiryDate: z.string().optional().nullable(),
  noExpiry: z.boolean().default(false),
  qtyOnHand: z.coerce.number().int().nonnegative(),
  costEgp: z.coerce.number().nonnegative().optional().nullable(),
  priceOverrideEgp: z.coerce.number().nonnegative().optional().nullable(),
  condition: z.enum(LOT_CONDITIONS).default('NEW'),
  saleFlag: z.boolean().default(false),
  status: z.enum(['LIVE', 'QUARANTINE', 'EXPIRED', 'WRITTEN_OFF']).default('LIVE'),
});
export type LotInput = z.input<typeof lotInputSchema>;

export type LotListOpts = {
  search?: string; status?: string; locationId?: string; productId?: string;
  sale?: string; stock?: string; expiring?: string; condition?: string;
  sort?: string; dir?: 'asc' | 'desc'; page?: number; perPage?: number;
};

function lotWhere(o: LotListOpts): Prisma.LotWhereInput {
  return {
    ...(o.status ? { status: o.status as 'LIVE' | 'QUARANTINE' | 'EXPIRED' | 'WRITTEN_OFF' } : {}),
    ...(o.locationId ? { locationId: o.locationId } : {}),
    ...(o.productId ? { productId: o.productId } : {}),
    ...(o.sale === '1' ? { saleFlag: true } : {}),
    ...(o.condition ? { condition: o.condition } : {}),
    ...(o.stock === 'in' ? { qtyOnHand: { gt: 0 } } : o.stock === 'zero' ? { qtyOnHand: { lte: 0 } } : o.stock === 'low' ? { qtyOnHand: { lte: 5 } } : {}), // 'low' (≤5) matches the dashboard low-stock KPI
    // Expiring-within filter (V4 C13) — dated lots expiring inside N days.
    ...(o.expiring && Number(o.expiring) > 0
      ? { expiryDate: { not: null, lt: new Date(Date.now() + Number(o.expiring) * 86_400_000) } }
      : {}),
    ...(o.search
      ? { product: { OR: [{ nameEn: { contains: o.search, mode: 'insensitive' } }, { sku: { contains: o.search, mode: 'insensitive' } }] } }
      : {}),
  };
}

function lotOrderBy(sort?: string, dir: 'asc' | 'desc' = 'asc'): Prisma.LotOrderByWithRelationInput {
  switch (sort) {
    case 'product': return { product: { nameEn: dir } };
    case 'location': return { location: { name: dir } };
    case 'onhand': return { qtyOnHand: dir };
    case 'price': return { priceOverridePiastres: dir };
    case 'status': return { status: dir };
    case 'expiry':
    default: return { expiryDate: dir };
  }
}

/** List lots for the admin. Without `page` it returns up to 300; with `page` it
 *  paginates by `perPage` and applies the chosen sort/filters. */
export function listLots(opts: LotListOpts = {}) {
  const perPage = opts.perPage ?? 50;
  const take = opts.page != null ? perPage : 300;
  const skip = opts.page != null ? (Math.max(1, opts.page) - 1) * perPage : 0;
  return prisma.lot.findMany({
    where: lotWhere(opts),
    include: { product: { select: { nameEn: true, sku: true, basePricePiastres: true } }, location: true },
    orderBy: lotOrderBy(opts.sort, opts.dir),
    skip,
    take,
  });
}

export function countLots(opts: LotListOpts = {}) {
  return prisma.lot.count({ where: lotWhere(opts) });
}

/** All lots for one product (for the product-edit stock section), nearest expiry first. */
export function listProductLots(productId: string) {
  return prisma.lot.findMany({
    where: { productId },
    include: { location: true },
    orderBy: [{ status: 'asc' }, { expiryDate: 'asc' }],
  });
}

export function getLot(id: string) {
  return prisma.lot.findUnique({
    where: { id },
    include: {
      product: { include: { brand: { select: { nameEn: true } }, images: { orderBy: { sortOrder: 'asc' }, take: 1 } } },
      location: true,
    },
  });
}

export async function saveLot(id: string | null, raw: LotInput) {
  const user = await requirePermission('inventory.manage');
  const d = lotInputSchema.parse(raw);
  const data = {
    productId: d.productId,
    locationId: d.locationId,
    expiryDate: d.noExpiry || !d.expiryDate ? null : new Date(d.expiryDate),
    qtyOnHand: d.qtyOnHand,
    costPiastres: d.costEgp != null ? egpToPiastres(d.costEgp) : null,
    priceOverridePiastres: d.priceOverrideEgp != null ? egpToPiastres(d.priceOverrideEgp) : null,
    condition: d.condition,
    saleFlag: d.saleFlag,
    status: d.status,
  };

  if (id) {
    // One transaction so the read, write and ADJUST ledger row agree — a sale
    // landing between them used to be clobbered with a mismatched delta.
    const lot = await prisma.$transaction(async (tx) => {
      const before = await tx.lot.findUniqueOrThrow({ where: { id } });
      const updated = await tx.lot.update({ where: { id }, data });
      const delta = d.qtyOnHand - before.qtyOnHand;
      if (delta !== 0) {
        await tx.movementLedger.create({ data: { lotId: id, locationId: d.locationId, type: 'ADJUST', qtyDelta: delta, reason: 'manual edit' } });
      }
      return updated;
    });
    await audit({ actorType: 'USER', actorId: user.id, action: 'lot.update', entityType: 'Lot', entityId: id });
    return lot;
  }

  const lot = await prisma.$transaction(async (tx) => {
    const created = await tx.lot.create({ data });
    await tx.movementLedger.create({ data: { lotId: created.id, locationId: d.locationId, type: 'STOCK_IN', qtyDelta: d.qtyOnHand, reason: 'manual create' } });
    return created;
  });
  await audit({ actorType: 'USER', actorId: user.id, action: 'lot.create', entityType: 'Lot', entityId: lot.id });
  return lot;
}

/** Set price-per-expiry on a lot (pharmacist-confirmed). Emits a change event. */
export async function setLotPrice(lotId: string, priceOverrideEgp: number | null, saleFlag: boolean) {
  const user = await requirePermission('inventory.manage');
  const lot = await prisma.lot.update({
    where: { id: lotId },
    data: { priceOverridePiastres: priceOverrideEgp != null ? egpToPiastres(priceOverrideEgp) : null, saleFlag },
  });
  if (saleFlag) {
    await prisma.productChangeEvent.create({ data: { productId: lot.productId, type: 'SALE_LOT', newValue: String(priceOverrideEgp ?? '') } });
  }
  await audit({ actorType: 'USER', actorId: user.id, action: 'lot.price', entityType: 'Lot', entityId: lotId });
  return lot;
}

export async function setLotStatus(lotId: string, status: 'LIVE' | 'QUARANTINE' | 'EXPIRED' | 'WRITTEN_OFF') {
  const user = await requirePermission('inventory.manage');
  const lot = await prisma.lot.update({ where: { id: lotId }, data: { status } });
  await audit({ actorType: 'USER', actorId: user.id, action: `lot.${status.toLowerCase()}`, entityType: 'Lot', entityId: lotId });
  return lot;
}

/**
 * Auto-expire overdue lots (V4 C6). Any LIVE lot whose expiry date has passed
 * flips to EXPIRED — off the storefront, out of sellable stock, out of FEFO.
 * Runs daily from the worker (and once at deploy); reserveStock also guards the
 * gap between sweeps. Returns how many lots were expired.
 */
export async function expireOverdueLots(): Promise<{ expired: number }> {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  const { count } = await prisma.lot.updateMany({
    where: { status: 'LIVE', expiryDate: { not: null, lt: today } },
    data: { status: 'EXPIRED' },
  });
  if (count > 0) {
    await audit({ actorType: 'SYSTEM', action: 'lot.auto_expired', entityType: 'Lot', data: { count } });
  }
  return { expired: count };
}

export type ReservationBinding = {
  lotId: string;
  reservationId: string;
  qty: number;
  expiryDate: Date | null;
  priceOverridePiastres: bigint | null;
};

/** FEFO soft-hold (FR-INV-03). Reserves `qty` across nearest-expiry lots,
 *  splitting if needed. Throws INSUFFICIENT_STOCK if not enough is available.
 *  `locationId` is an optional filter — the storefront reserves across ALL
 *  locations (production locations have generated ids, so a hard-coded id
 *  would find no stock; that bug blanked every cart on the live site).
 *  Default FEFO only pools NEW-condition lots; a condition variant is reserved
 *  either by pinning its exact lot (`lotId`, buy-box pick) or by condition
 *  (`condition`, cart qty updates). */
export async function reserveStock(
  productId: string,
  locationId: string | null,
  qty: number,
  opts: { sessionId?: string; orderId?: string; holdMinutes?: number; lotId?: string; condition?: string } = {},
): Promise<ReservationBinding[]> {
  const expiresAt = new Date(Date.now() + (opts.holdMinutes ?? HOLD_MINUTES_DEFAULT) * 60_000);
  return prisma.$transaction(async (tx) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const lots = await tx.lot.findMany({
      where: {
        productId,
        ...(locationId ? { locationId } : {}),
        status: 'LIVE',
        // Guard the window between daily auto-expire sweeps — never sell an
        // overdue lot even while it still says LIVE (V4 C6).
        OR: [{ expiryDate: null }, { expiryDate: { gte: today } }],
        ...(opts.lotId ? { id: opts.lotId } : { condition: opts.condition ?? 'NEW' }),
      },
      orderBy: { expiryDate: 'asc' },
    });
    const bindings: ReservationBinding[] = [];
    let remaining = qty;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const avail = availableQty(lot);
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);
      // Atomic claim: the availability check must be INSIDE the UPDATE, or two
      // concurrent carts both read the same counts and oversell the lot.
      const claimed = await tx.$executeRaw`UPDATE "Lot" SET "qtyReserved" = "qtyReserved" + ${take} WHERE "id" = ${lot.id} AND "qtyOnHand" - "qtyReserved" >= ${take}`;
      if (claimed === 0) continue; // raced by another cart — try the next lot
      const res = await tx.lotReservation.create({
        data: { lotId: lot.id, qty: take, sessionId: opts.sessionId, orderId: opts.orderId, expiresAt },
      });
      await tx.movementLedger.create({ data: { lotId: lot.id, locationId: lot.locationId, type: 'RESERVE', qtyDelta: -take, refType: 'reservation', refId: res.id } });
      bindings.push({ lotId: lot.id, reservationId: res.id, qty: take, expiryDate: lot.expiryDate, priceOverridePiastres: lot.priceOverridePiastres });
      remaining -= take;
    }
    if (remaining > 0) throw new Error('INSUFFICIENT_STOCK');
    return bindings;
  });
}

export async function releaseReservation(reservationId: string) {
  return prisma.$transaction(async (tx) => {
    const res = await tx.lotReservation.findUnique({ where: { id: reservationId }, include: { lot: true } });
    if (!res) return;
    // Atomic decrement — a concurrent double-release is serialized by the
    // reservation delete below (second tx hits P2025 and rolls back fully).
    await tx.lot.update({ where: { id: res.lotId }, data: { qtyReserved: { decrement: res.qty } } });
    await tx.movementLedger.create({ data: { lotId: res.lotId, locationId: res.lot.locationId, type: 'RELEASE', qtyDelta: res.qty, refType: 'reservation', refId: res.id } });
    await tx.lotReservation.delete({ where: { id: reservationId } });
  });
}

/** Sweep expired soft-holds (run from a job in P12). */
export async function releaseExpiredReservations(now = new Date()): Promise<number> {
  const expired = await prisma.lotReservation.findMany({ where: { expiresAt: { lt: now } }, select: { id: true } });
  // A concurrent sweep/user-release deleting the same row makes the tx throw
  // P2025 (and roll back) — skip it and keep sweeping the rest.
  for (const r of expired) { try { await releaseReservation(r.id); } catch { /* raced — already released */ } }
  return expired.length;
}

/** Suggested short-expiry discount for a lot (FR-INV-05) — pharmacist confirms. */
export async function lotSuggestion(lotId: string) {
  const lot = await prisma.lot.findUnique({ where: { id: lotId }, include: { product: true } });
  if (!lot) return null;
  if (!lot.expiryDate) return null; // NA / non-perishable — no short-expiry discount
  const since = new Date(Date.now() - 90 * 86_400_000);
  const sold = await prisma.orderItem.aggregate({ _sum: { qty: true }, where: { productId: lot.productId, order: { placedAt: { gte: since } } } });
  const monthlyVelocity = (sold._sum.qty ?? 0) / 3;
  const consumptionDays =
    lot.product.servingsPerUnit && lot.product.dailyDosage
      ? Math.floor(lot.product.servingsPerUnit / lot.product.dailyDosage)
      : 0;
  const s = suggestDiscountPct({
    daysToExpiry: daysToExpiry(lot.expiryDate, new Date()),
    stockQty: lot.qtyOnHand,
    monthlyVelocity,
    consumptionDays,
  });
  return { ...s, suggestedPiastres: s.pct > 0 ? discountedPiastres(lot.product.basePricePiastres, s.pct) : null };
}
