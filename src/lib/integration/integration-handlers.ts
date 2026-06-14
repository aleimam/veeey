import { prisma } from '@/lib/prisma';
import type { SpecialOrderStatus } from '@/generated/prisma/client';

/**
 * Inbound YeldnIN webhook handlers (INTEGRATION_CONTRACT §5). `shipment.received`
 * is the high-value stock-in handoff (builds FEFO lots); the status/milestone/
 * delivery handlers record progress. ⚠️ Exact status mapping + compensation math
 * trace to a contract snapshot — re-baseline before enabling in staging.
 */
type ShipmentLot = { quantity: number; expiryMonth: number; expiryYear: number; batchNumber?: string | null };
type ShipmentItem = { batchId?: number; requestUid?: string; sku?: string | null; productName?: string; quantity: number; lots?: ShipmentLot[] };
type ShipmentPayload = { shipmentId: number; receivedAt?: string; items?: ShipmentItem[] };

export async function handleShipmentReceived(payload: ShipmentPayload): Promise<{ lotsCreated: number; unmatched: number }> {
  const location = await prisma.location.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!location) return { lotsCreated: 0, unmatched: 0 };

  let lotsCreated = 0;
  let unmatched = 0;
  for (const item of payload.items ?? []) {
    const product = item.sku ? await prisma.product.findFirst({ where: { sku: item.sku } }) : null;
    if (!product) { unmatched += 1; continue; }
    // Lots may be empty or sum to fewer than quantity → those units are "expiry unknown"; we only shelve specified lots.
    for (const lot of item.lots ?? []) {
      const expiry = new Date(Date.UTC(lot.expiryYear, Math.max(0, Math.min(11, lot.expiryMonth - 1)), 1));
      const created = await prisma.lot.create({
        data: { productId: product.id, locationId: location.id, expiryDate: expiry, qtyOnHand: lot.quantity, sourceBatchId: item.batchId != null ? String(item.batchId) : null, status: 'LIVE' },
      });
      await prisma.movementLedger.create({ data: { lotId: created.id, locationId: location.id, type: 'STOCK_IN', qtyDelta: lot.quantity, refType: 'yeldnin_shipment', refId: String(payload.shipmentId) } });
      lotsCreated += 1;
    }
  }
  return { lotsCreated, unmatched };
}

const SALES_STATUS_MAP: Record<string, SpecialOrderStatus> = {
  ORDERED: 'SOURCING', PURCHASED: 'PURCHASED', SHIPPED: 'IN_TRANSIT', SHIPPED_SUPPLIER: 'IN_TRANSIT',
  IN_EGYPT: 'RECEIVED', RECEIVED: 'RECEIVED', DELIVERED: 'FULFILLED', CANCELLED: 'CANCELLED',
};

async function recordMilestone(requestUid: string, key: string, at?: string): Promise<{ matched: boolean }> {
  const so = await prisma.specialOrder.findFirst({ where: { yeldnRequestUid: requestUid } });
  if (!so) return { matched: false };
  const milestones: Record<string, string> = { ...((so.milestonesJson as Record<string, string> | null) ?? {}) };
  milestones[key] = at ?? new Date().toISOString();
  const mappedStatus = SALES_STATUS_MAP[key];
  await prisma.specialOrder.update({ where: { id: so.id }, data: { milestonesJson: milestones, ...(mappedStatus ? { status: mappedStatus } : {}) } });
  return { matched: true };
}

export function handleRequestStatusChanged(p: { requestUid: string; salesStatusCode: string; changedAt?: string }) {
  return recordMilestone(p.requestUid, p.salesStatusCode, p.changedAt);
}

export function handleSpecialOrderMilestone(p: { requestUid: string; milestone: string; occurredAt?: string }) {
  return recordMilestone(p.requestUid, p.milestone, p.occurredAt);
}

export async function handleDeliveryStatusChanged(p: { veeeyOrderId?: string | null; status: string; courierName?: string | null }) {
  if (!p.veeeyOrderId) return { matched: false };
  const order = await prisma.order.findFirst({ where: { number: p.veeeyOrderId } });
  if (!order) return { matched: false };
  if (p.courierName) await prisma.order.update({ where: { id: order.id }, data: { courier: 'OWN' } }).catch(() => {});
  return { matched: true };
}

export async function dispatchInboundEvent(type: string, payload: unknown): Promise<{ handled: boolean; detail?: unknown }> {
  switch (type) {
    case 'shipment.received':
      return { handled: true, detail: await handleShipmentReceived(payload as ShipmentPayload) };
    case 'request.status_changed':
      return { handled: true, detail: await handleRequestStatusChanged(payload as { requestUid: string; salesStatusCode: string; changedAt?: string }) };
    case 'special_order.milestone':
      return { handled: true, detail: await handleSpecialOrderMilestone(payload as { requestUid: string; milestone: string; occurredAt?: string }) };
    case 'delivery.status_changed':
      return { handled: true, detail: await handleDeliveryStatusChanged(payload as { veeeyOrderId?: string | null; status: string; courierName?: string | null }) };
    default:
      return { handled: false };
  }
}
