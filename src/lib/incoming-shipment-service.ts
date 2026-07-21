import { prisma } from '@/lib/prisma';
import { parseShipmentReceived, totalUnits, type WireShipmentReceived } from '@/lib/integration/shipment-wire';

/**
 * Incoming Shipments (YeldnIN stock-in), Stage 1 — the RECEIVER.
 *
 * A `shipment.received` event lands here as a **review record only**. It creates
 * NO lots and moves NO stock: Sales must compare the entered expiry dates against
 * Ops' photos and approve, and that approval (Stage 3) is what makes stock
 * sellable. So arming this channel is safe on its own.
 */

export type ReceiveResult =
  | { ok: true; shipmentId: string; created: boolean; units: number; unmatchedLines: number }
  | { ok: false; error: string };

/** Resolve a wire line to a Veeey product: canonical SKU first, legacy WP id as
 *  the fallback. Never guesses by name — an unmatched line is held for review. */
async function resolveProductId(sku: string | null, veeeyWpId: number | null): Promise<string | null> {
  if (sku) {
    const bySku = await prisma.product.findFirst({ where: { sku }, select: { id: true } });
    if (bySku) return bySku.id;
  }
  if (veeeyWpId != null) {
    const byWp = await prisma.product.findFirst({ where: { legacyWpId: veeeyWpId }, select: { id: true } });
    if (byWp) return byWp.id;
  }
  return null;
}

export async function receiveShipment(payload: unknown): Promise<ReceiveResult> {
  const wire = parseShipmentReceived(payload);
  if (!wire) return { ok: false, error: 'validation_failed' };

  // Idempotent on YeldnIN's uid. A re-fired event REPLACES the lines of a
  // still-pending shipment (Ops may have corrected an expiry and resent), but
  // never touches one Sales already decided on — that would silently rewrite
  // what somebody signed off.
  const existing = await prisma.incomingShipment.findUnique({
    where: { yeldninUid: wire.shipmentUid },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== 'PENDING_REVIEW') {
    return { ok: true, shipmentId: existing.id, created: false, units: 0, unmatchedLines: 0 };
  }

  const lots: { productId: string | null; sku: string | null; productName: string; expiryDate: Date | null; lotCode: string | null; quantity: number; unitCost: number | null; currency: string | null }[] = [];
  let unmatchedLines = 0;
  for (const line of wire.lines) {
    const productId = await resolveProductId(line.sku, line.veeeyWpId);
    if (!productId) unmatchedLines += 1;
    for (const lot of line.lots) {
      lots.push({
        productId,
        sku: line.sku,
        productName: line.productName,
        expiryDate: lot.expiryDate ? new Date(`${lot.expiryDate}T00:00:00.000Z`) : null,
        lotCode: lot.lotCode,
        quantity: lot.quantity,
        unitCost: lot.unitCost,
        currency: lot.currency,
      });
    }
  }

  const receivedAt = new Date(wire.receivedAt);
  const shipment = await prisma.$transaction(async (tx) => {
    const s = existing
      ? await tx.incomingShipment.update({
          where: { id: existing.id },
          data: { yeldninId: wire.shipmentId, receivedAt },
        })
      : await tx.incomingShipment.create({
          data: { yeldninUid: wire.shipmentUid, yeldninId: wire.shipmentId, receivedAt, status: 'PENDING_REVIEW' },
        });
    // Replace children wholesale — a resend is the corrected truth, and merging
    // would leave stale lots from the superseded version behind.
    if (existing) {
      await tx.incomingShipmentLot.deleteMany({ where: { shipmentId: s.id } });
      await tx.incomingShipmentPhoto.deleteMany({ where: { shipmentId: s.id } });
    }
    if (lots.length) await tx.incomingShipmentLot.createMany({ data: lots.map((l) => ({ ...l, shipmentId: s.id })) });
    if (wire.photoAssetIds.length) {
      await tx.incomingShipmentPhoto.createMany({ data: wire.photoAssetIds.map((assetId) => ({ shipmentId: s.id, assetId })) });
    }
    return s;
  });

  return { ok: true, shipmentId: shipment.id, created: !existing, units: totalUnits(wire), unmatchedLines };
}

export function listIncomingShipments(status?: string) {
  return prisma.incomingShipment.findMany({
    where: status ? { status } : undefined,
    orderBy: { receivedAt: 'desc' },
    take: 100,
    include: { _count: { select: { lots: true, photos: true } } },
  });
}

export function getIncomingShipment(id: string) {
  return prisma.incomingShipment.findUnique({
    where: { id },
    include: {
      lots: { orderBy: [{ productName: 'asc' }, { expiryDate: 'asc' }] },
      photos: { orderBy: { id: 'asc' } },
    },
  });
}

/** Units awaiting a Sales decision — the number worth badging in the nav. */
export function pendingShipmentCount() {
  return prisma.incomingShipment.count({ where: { status: 'PENDING_REVIEW' } });
}

export type { WireShipmentReceived };
