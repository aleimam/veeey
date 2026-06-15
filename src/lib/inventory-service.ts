import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';
import { availableQty, daysToExpiry } from '@/lib/inventory';
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
  saleFlag: z.boolean().default(false),
  status: z.enum(['LIVE', 'QUARANTINE', 'EXPIRED', 'WRITTEN_OFF']).default('LIVE'),
});
export type LotInput = z.input<typeof lotInputSchema>;

export function listLots(opts: { status?: string; productId?: string } = {}) {
  return prisma.lot.findMany({
    where: {
      ...(opts.status ? { status: opts.status as 'LIVE' | 'QUARANTINE' | 'EXPIRED' | 'WRITTEN_OFF' } : {}),
      ...(opts.productId ? { productId: opts.productId } : {}),
    },
    include: { product: { select: { nameEn: true, sku: true, basePricePiastres: true } }, location: true },
    orderBy: [{ status: 'asc' }, { expiryDate: 'asc' }],
    take: 300,
  });
}

export function getLot(id: string) {
  return prisma.lot.findUnique({ where: { id }, include: { product: true, location: true } });
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
    saleFlag: d.saleFlag,
    status: d.status,
  };

  if (id) {
    const before = await prisma.lot.findUnique({ where: { id } });
    const lot = await prisma.lot.update({ where: { id }, data });
    const delta = d.qtyOnHand - (before?.qtyOnHand ?? 0);
    if (delta !== 0) {
      await prisma.movementLedger.create({ data: { lotId: id, locationId: d.locationId, type: 'ADJUST', qtyDelta: delta, reason: 'manual edit' } });
    }
    await audit({ actorType: 'USER', actorId: user.id, action: 'lot.update', entityType: 'Lot', entityId: id });
    return lot;
  }

  const lot = await prisma.lot.create({ data });
  await prisma.movementLedger.create({ data: { lotId: lot.id, locationId: d.locationId, type: 'STOCK_IN', qtyDelta: d.qtyOnHand, reason: 'manual create' } });
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

export type ReservationBinding = {
  lotId: string;
  reservationId: string;
  qty: number;
  expiryDate: Date | null;
  priceOverridePiastres: bigint | null;
};

/** FEFO soft-hold (FR-INV-03). Reserves `qty` across nearest-expiry lots,
 *  splitting if needed. Throws INSUFFICIENT_STOCK if not enough is available. */
export async function reserveStock(
  productId: string,
  locationId: string,
  qty: number,
  opts: { sessionId?: string; orderId?: string; holdMinutes?: number } = {},
): Promise<ReservationBinding[]> {
  const expiresAt = new Date(Date.now() + (opts.holdMinutes ?? HOLD_MINUTES_DEFAULT) * 60_000);
  return prisma.$transaction(async (tx) => {
    const lots = await tx.lot.findMany({
      where: { productId, locationId, status: 'LIVE' },
      orderBy: { expiryDate: 'asc' },
    });
    const bindings: ReservationBinding[] = [];
    let remaining = qty;
    for (const lot of lots) {
      if (remaining <= 0) break;
      const avail = availableQty(lot);
      if (avail <= 0) continue;
      const take = Math.min(avail, remaining);
      await tx.lot.update({ where: { id: lot.id }, data: { qtyReserved: lot.qtyReserved + take } });
      const res = await tx.lotReservation.create({
        data: { lotId: lot.id, qty: take, sessionId: opts.sessionId, orderId: opts.orderId, expiresAt },
      });
      await tx.movementLedger.create({ data: { lotId: lot.id, locationId, type: 'RESERVE', qtyDelta: -take, refType: 'reservation', refId: res.id } });
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
    await tx.lot.update({ where: { id: res.lotId }, data: { qtyReserved: Math.max(0, res.lot.qtyReserved - res.qty) } });
    await tx.movementLedger.create({ data: { lotId: res.lotId, locationId: res.lot.locationId, type: 'RELEASE', qtyDelta: res.qty, refType: 'reservation', refId: res.id } });
    await tx.lotReservation.delete({ where: { id: reservationId } });
  });
}

/** Sweep expired soft-holds (run from a job in P12). */
export async function releaseExpiredReservations(now = new Date()): Promise<number> {
  const expired = await prisma.lotReservation.findMany({ where: { expiresAt: { lt: now } }, select: { id: true } });
  for (const r of expired) await releaseReservation(r.id);
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
