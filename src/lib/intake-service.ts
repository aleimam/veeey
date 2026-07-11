import { prisma } from '@/lib/prisma';
import { requirePermission } from '@/lib/auth-guards';
import { audit } from '@/lib/audit';
import { egpToPiastres } from '@/lib/format';

/**
 * Stock-in intake (FR-INV-06). In production this is triggered by YeldnIN's
 * `shipment.received` event (P14). Here it's mocked: received goods land as
 * QUARANTINE lots; Ops/Sales then confirm expiry + price-per-expiry and publish
 * them LIVE, which is the single point where stock becomes sellable.
 */

export async function mockShipmentReceived(
  items: { sku: string; qty: number; batchId?: string }[],
  locationId?: string,
) {
  const user = await requirePermission('inventory.manage');
  // No hard-coded 'loc_main' — that id only exists in the dev seed (same bug
  // class as the P0 cart fix); default to the oldest real location.
  const location = locationId
    ? await prisma.location.findUnique({ where: { id: locationId } })
    : await prisma.location.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!location) throw new Error('NO_LOCATION');
  const created: string[] = [];
  for (const it of items) {
    const product = await prisma.product.findUnique({ where: { sku: it.sku } });
    if (!product) continue;
    const lot = await prisma.lot.create({
      data: {
        productId: product.id,
        locationId: location.id,
        // Placeholder expiry until Ops confirms at intake.
        expiryDate: new Date(Date.now() + 365 * 86_400_000),
        qtyOnHand: it.qty,
        status: 'QUARANTINE',
        sourceBatchId: it.batchId,
      },
    });
    created.push(lot.id);
  }
  await audit({ actorType: 'SYSTEM', actorId: user.id, action: 'intake.received', data: { items: items.length, created: created.length } });
  return created;
}

export function listPendingIntake(locationId?: string) {
  return prisma.lot.findMany({
    where: { status: 'QUARANTINE', ...(locationId ? { locationId } : {}) },
    include: { product: { select: { nameEn: true, sku: true, basePricePiastres: true } }, location: true },
    orderBy: { receivedAt: 'desc' },
  });
}

/** Confirm a received lot and publish it to the live catalog. Cost is editable
 *  at confirm time (V4 C10) — omitted = keep whatever the shipment carried. */
export async function publishIntakeLot(
  lotId: string,
  input: { expiryDate: string; noExpiry?: boolean; priceOverrideEgp?: number | null; saleFlag?: boolean; costEgp?: number | null },
) {
  const user = await requirePermission('inventory.manage');
  const lot = await prisma.lot.findUnique({ where: { id: lotId } });
  if (!lot) throw new Error('NOT_FOUND');

  // Was the product out of stock before this lot goes live? (drives back-in-stock alerts)
  const liveCount = await prisma.lot.count({ where: { productId: lot.productId, status: 'LIVE', qtyOnHand: { gt: 0 } } });

  const updated = await prisma.lot.update({
    where: { id: lotId },
    data: {
      expiryDate: input.noExpiry || !input.expiryDate ? null : new Date(input.expiryDate),
      priceOverridePiastres: input.priceOverrideEgp != null ? egpToPiastres(input.priceOverrideEgp) : null,
      ...(input.costEgp != null ? { costPiastres: egpToPiastres(input.costEgp) } : {}),
      saleFlag: !!input.saleFlag,
      status: 'LIVE',
    },
  });
  await prisma.movementLedger.create({ data: { lotId, locationId: lot.locationId, type: 'STOCK_IN', qtyDelta: lot.qtyOnHand, refType: 'intake' } });
  if (liveCount === 0) {
    await prisma.productChangeEvent.create({ data: { productId: lot.productId, type: 'BACK_IN_STOCK' } });
  }
  await audit({ actorType: 'USER', actorId: user.id, action: 'intake.publish', entityType: 'Lot', entityId: lotId });
  return updated;
}
